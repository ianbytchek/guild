import {AbstractFactory} from './Dependency/AbstractFactory';
import {AbstractTaskFactory} from './AbstractTaskFactory';
import {ConfigurationInterface} from '../Configuration/Configuration';
import {GulpHelp} from 'gulp-help';
import {NormaliseFactory, NormaliseConfiguration} from './Dependency/NormaliseFactory';
import {ParsedArgs} from 'minimist';
import {PathConfiguration} from '../Configuration/PathConfiguration';
import {Task as TaskName} from '../Constant/Task';

import sequence = require('run-sequence');

export type Configuration = [DependencyConfiguration, PathConfiguration];

export interface DependencyConfiguration extends ConfigurationInterface {
    normalise?: NormaliseConfiguration | NormaliseConfiguration[];
}

export class DependencyFactory extends AbstractTaskFactory {

    /**
     * @inheritDoc
     */
    public normaliseConfiguration(configuration: Configuration, parameters?: ParsedArgs): Configuration {
        return configuration;
    }

    /**
     * @inheritDoc
     */
    public construct() {
        let parameters: ParsedArgs = this.parameters;
        let configuration: Configuration = this.normaliseConfiguration(this.configuration, parameters);
        let [dependencyConfiguration, pathConfiguration] = configuration;
        let gulp: GulpHelp = this.gulp;

        // Define available subtask factories by configuration key.

        let factories: { [id: string]: typeof AbstractFactory } = {
            normalise: NormaliseFactory
        };

        // 

        let options: { [id: string]: string } = {};
        let tasks: any[] = [];

        // Gulp help stuff.

        let description: string = 'Clean and build dependencies into local libraries.';

        options['production'] = 'Build for production, will minify and strip everything it can. Very slow… \uD83D\uDC22';
        options['watch'] = 'Watch files for changes to re-run.';

        Object.keys(dependencyConfiguration).forEach(function (key: string) {
            if (factories[key] == null) {
                return;
            }

            let factory: AbstractFactory = new (<any>factories[key])();

            factory.configuration = [dependencyConfiguration[key], pathConfiguration];
            factory.gulp = gulp;
            factory.options = options;
            factory.parameters = parameters;

            tasks.push(factory.construct());
        });

        gulp.task(TaskName.DEPENDENCY, description, function (callback) {
            if (tasks.length === 0) {
                throw new Error('No tasks were configured, make sure your configuration is correct.');
            } else {
                tasks.push(callback);
            }

            return sequence.use(gulp).apply(null, tasks);
        }, {options: options});
    }
}