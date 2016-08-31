import babel from "rollup-plugin-babel"

export default babel(
  {
    // Don't try to find .babelrc because we want to force this configuration.
    babelrc: false,

    exclude: "node_modules/**",

    presets:
    [
      [
        "es2015",
        {
          modules: false,
          loose: true
        }
      ],

      "es2016",
      "es2017",

      // Polyfills
      "transform-runtime"
    ]
  })
