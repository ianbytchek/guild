import {AbstractFactory, Task} from './Build/AbstractFactory';
import {AbstractTaskFactory} from './AbstractTaskFactory';
import {ConfigurationInterface} from '../Configuration/Configuration';
import {GulpHelp} from 'gulp-help';
import {LessFactory, LessConfiguration} from './Build/LessFactory';
import {ParsedArgs} from 'minimist';
import {PathConfiguration} from '../Configuration/PathConfiguration';
import {Task as TaskName} from '../Constant/Task';
import {TwigFactory, TwigConfiguration} from './Build/TwigFactory';
import {WebpackFactory, WebpackConfiguration} from './Build/WebpackFactory';

import sequence = require('run-sequence');

export type Configuration = [BuildConfiguration, PathConfiguration];

export interface BuildConfiguration extends ConfigurationInterface {
    less?:LessConfiguration;
    twig?:TwigConfiguration;
    webpack?:WebpackConfiguration;
}

export class BuildFactory extends AbstractTaskFactory {

    /**
     * @inheritDoc
     */
    public normaliseConfiguration(configuration:Configuration, parameters?:ParsedArgs):Configuration {
        return configuration;
    }

    /**
     * @inheritDoc
     */
    public construct() {
        var parameters:ParsedArgs = this.parameters;
        var configuration:Configuration = this.normaliseConfiguration(this.configuration, parameters);
        var [buildConfiguration, pathConfiguration] = configuration;
        var gulp:GulpHelp = this.gulp;

        // Define available subtask factories by configuration key.

        var factories:{[id:string]:typeof AbstractFactory} = {
            less: LessFactory,
            twig: TwigFactory,
            webpack: WebpackFactory
        };

        // Depending on configuration we may have clean tasks, which must be run before the actual build tasks. If we
        // have a watch option on cli, we must also construct watch tasks.

        var options:{[id:string]:string} = {};
        var buildTasks:string[] = [];
        var cleanTasks:string[] = [];
        var watchTasks:string[] = [];

        // Fixme: schema allows to pass path arrays, but this will fail when we join them. This must be handled separately.

        Object.keys(buildConfiguration).forEach(function (key:string) {
            if (factories[key] == null) {
                return;
            }

            var factory:AbstractFactory = new (<any>factories[key])();

            factory.configuration = [buildConfiguration[key], pathConfiguration];
            factory.gulp = gulp;
            factory.options = options;
            factory.parameters = parameters;

            var [builds, cleans, watches]:Task = factory.construct();

            buildTasks = buildTasks.concat(builds);
            cleanTasks = cleanTasks.concat(cleans);
            watchTasks = watchTasks.concat(watches);
        });

        // Gulp help stuff.

        var description:string = 'Clean and build target (js, css) sources, when no target is given, builds for everything.';

        options['production'] = 'Build for production, will minify and strip everything it can. Very slow… \uD83D\uDC22';
        options['watch'] = 'Watch files for changes to re-run.';

        gulp.task(TaskName.BUILD, description, function (callback:Function) {
            var tasks:any[] = [];

            cleanTasks.length > 0 && tasks.push(cleanTasks);
            buildTasks.length > 0 && tasks.push.apply(tasks, buildTasks);
            watchTasks.length > 0 && tasks.push.apply(tasks, watchTasks);

            if (tasks.length === 0) {
                throw new Error('No tasks were configured, make sure your configuration is correct.');
            } else {
                tasks.push(callback);
            }

            return sequence.use(gulp)(...tasks);
        }, {options: options});
    }
}