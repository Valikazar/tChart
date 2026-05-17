const webpack = require('webpack');

module.exports = function override(config) {
    // Add polyfills for Webpack 5
    config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        assert: require.resolve('assert'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify'),
        url: require.resolve('url'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
    };

    config.plugins = [
        ...config.plugins,
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
    ];

    // Fix for @react-native-async-storage/async-storage ESM issue
    config.module.rules.push({
        test: /\.m?js/,
        resolve: {
            fullySpecified: false
        }
    });

    // Ignore source map warnings if GENERATE_SOURCEMAP=false is not enough for everything
    config.ignoreWarnings = [/Failed to parse source map/];

    return config;
}
