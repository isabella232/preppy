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
          modules: false
        }
      ],

      "es2016",
      "es2017",
      "react"
    ],

    plugins:
    [
      // class { handleClick = () => { } }
      "transform-class-properties",

      // { ...todo, completed: true }
      "transform-object-rest-spread",

      // Add Polyfills for Promise, Set, Map, etc. as needed
      "transform-runtime",

      // Optimization: hoist JSX that never changes out of render()
      "transform-react-constant-elements"
    ]
  })
