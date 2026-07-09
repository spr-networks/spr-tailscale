const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
var HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {

      webpackConfig.plugins.forEach(plugin => {
        if (plugin instanceof InlineChunkHtmlPlugin) {
          plugin.tests =  [ /.+[.]js/ ]
          plugin.options =  { inject: 'body'}
        }

      })

      // gluestack-ui / gluestack-style ship untranspiled JSX in their published
      // packages, and CRA's babel-loader only covers src/. Extend that loader's
      // include list so those modules get transpiled instead of hitting webpack's
      // raw parser (otherwise: "Module parse failed: Unexpected token").
      const transpileModules = [
        /node_modules[\\/]@gluestack-ui[\\/]/,
        /node_modules[\\/]@gluestack-style[\\/]/,
        /node_modules[\\/]@legendapp[\\/]/
      ]
      webpackConfig.module.rules.forEach(rule => {
        if (!rule.oneOf) return
        rule.oneOf.forEach(loader => {
          const usesBabel =
            loader.loader && loader.loader.includes('babel-loader') && loader.include
          if (usesBabel) {
            loader.include = [].concat(loader.include, transpileModules)
          }
        })
      })

      const oneOfRuleIdx = webpackConfig.module.rules.findIndex(rule => !!rule.oneOf);
      webpackConfig.module.rules[oneOfRuleIdx].oneOf.forEach(loader => {
        if (loader.test && loader.test.test && (loader.test.test("test.module.css") || loader.test.test("test.module.scss"))) {
          loader.use.forEach(use => {
            if (use.loader && use.loader.includes('mini-css-extract-plugin')) {
              use.loader = require.resolve('style-loader');
            }
          })
        }
      })

      return webpackConfig
    }
  },
}
