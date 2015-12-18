'use strict';

var DataType = require('./Constant/DataType');
var Plugin = require('./Constant/Plugin');
var Schema = require('./Constant/Schema');
var SchemaValidator = require('./Validator/SchemaValidator');
var Task = require('./Constant/Task');
var TaskUtility = require('./Utility/TaskUtility');

var concat = require('gulp-concat');
var del = require('del');
var gulpif = require('gulp-if');
var merge = require('merge-stream');
var path = require('path');
var sequence = require('run-sequence');
var uglify = require('gulp-uglify');

/**
 * @param {Gulp} gulp
 * @param {DependencyConfiguration} configuration
 * @param {Object} parameters
 * @param {Array} cleanTasks
 * @param {Array} dependencyTasks
 */
function createDependencyNormaliseTask(gulp, configuration, parameters, cleanTasks, dependencyTasks) {
    var normaliseConfiguration = configuration.normalise;
    var pathConfiguration = configuration.path;

    dependencyTasks.push(Task.DEPENDENCY_NORMALISE);
    gulp.task(Task.DEPENDENCY_NORMALISE, false, function () {
        var streams = [];

        Object.keys(normaliseConfiguration).forEach(function (key) {

            /** @type {NormaliseTarget} */
            var target = normaliseConfiguration[key];
            var source;
            var destination;
            var plugins;
            var index;
            var pipeline;
            var basename;
            var extension;
            var filename;

            if (typeof target === DataType.STRING) {
                source = target;
            } else {
                source = target.source;
                destination = target.destination;
                plugins = target.plugins;
            }

            // If we didn't get destination we shall use standard library path. Also make sure we
            // make a proper filename for our final dependency.

            source = TaskUtility.normalisePath(pathConfiguration, 'dependency', source);

            if (destination == null && TaskUtility.doesPathConfigurationExist(pathConfiguration, 'library')) {
                destination = (extension = TaskUtility.getGlobExtension(source)) == null ? pathConfiguration.library : path.join(pathConfiguration.library, extension);
                basename = null;
            } else {
                basename = path.basename(destination);
            }

            // Use basename as our filename if it has an extension, otherwise try figuring it out
            // from source. If that didn't work, simply use key.

            if (path.extname(key) === '' && basename != null && (extension = path.extname(basename)) !== '') {
                filename = basename;
            } else if (path.extname(key) === '' && (extension = path.extname(source)) !== '') {
                filename = key + extension;
            } else {
                filename = key;
            }

            // Normalise plugins.

            (plugins == null || plugins.length === 0) && (plugins = [Plugin.DEFAULT]);
            (index = plugins.indexOf(Plugin.DEFAULT)) >= 0 && plugins.splice(index, 1, Plugin.NORMALISE);
            (index = plugins.indexOf(Plugin.NORMALISE)) >= 0 && plugins.splice(index, 1,

                //// Uglify if dealing with js files.
                gulpif(/.*\.js/, uglify()),

                // Just in case concat everything and output as a single file at a single
                // location, event if there's only one file, we still want to rename it.
                concat(filename)
            );

            pipeline = gulp.src(source).pipe(TaskUtility.createPlumber());

            plugins.forEach(function (plugin) {
                pipeline = pipeline.pipe(plugin);
            });

            streams.push(pipeline.pipe(gulp.dest(destination)));
        });

        return merge(streams);
    });
}

/**
 * @param {Gulp} gulp
 * @param {DependencyConfiguration} configuration
 * @param {Object} parameters
 * @param {Array} cleanTasks
 * @param {Array} dependencyTasks
 */
function createDependencyCleanTask(gulp, configuration, parameters, cleanTasks, dependencyTasks) {
    var cleanConfiguration = configuration.clean;
    var pathConfiguration = configuration.path;
    var target = cleanConfiguration;

    if (target === false) {
        return;
    } else if (target === true && TaskUtility.doesPathConfigurationExist(pathConfiguration, 'library')) {
        target = path.join(pathConfiguration.library, '*');
    }

    if (target == null) {
        throw new Error('No target configured.');
    }

    cleanTasks.push(Task.DEPENDENCY_CLEAN);
    gulp.task(Task.DEPENDENCY_CLEAN, function (callback) {
        return del(target, {force: true}, callback);
    });
}

/**
 * @param {Gulp} gulp
 * @param {GuildConfiguration} configuration
 * @param {Object} parameters
 */
function normalise(gulp, configuration, parameters) {
    var dependencyConfiguration = configuration.dependency;
    var pathConfiguration = configuration.path;
    var clean = dependencyConfiguration.clean != null;
    var normalise = dependencyConfiguration.normalise != null;
    var validator = new SchemaValidator();

    // Inject stuff into dependency configuration.

    dependencyConfiguration.path = pathConfiguration;

    // Gulp help stuff.

    var description = 'Clean and build dependencies into local libraries.';
    var options = {
        production: 'Build for production, will minify and strip everything it can. Very slow.',
        watch: 'Watch files for changes to re-run.'
    };
    var taskOptions = {
        clean: 'Clean dependencies.',
        normalise: 'Normalise dependencies.'
    };

    var cleanTasks = [];
    var dependencyTasks = [];
    var generators = {
        clean: createDependencyCleanTask,
        normalise: createDependencyNormaliseTask
    };

    Object.keys(dependencyConfiguration).forEach(function (key) {
        var generator = generators[key];
        var schema = Schema['DEPENDENCY_' + key.toUpperCase()];

        if (generator != null && schema != null && validator.validate(dependencyConfiguration[key], schema, {throwError: true})) {
            generator(gulp, dependencyConfiguration, parameters, cleanTasks, dependencyTasks);
            options[key] = taskOptions[key];
        }
    });

    gulp.task(Task.DEPENDENCY, description, function (callback) {
        var tasks = [];

        cleanTasks.length > 0 && tasks.push(cleanTasks);
        dependencyTasks.length > 0 && tasks.push.apply(tasks, dependencyTasks);

        if (tasks.length === 0) {
            throw new Error('No tasks were configured, make sure your configuration is correct.');
        } else {
            tasks.push(callback);
        }

        return sequence.use(gulp).apply(null, tasks);
    }, {options: options});
}

module.exports = normalise;