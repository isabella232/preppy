export default function getBanner(pkg) {
  var banner = `/*! ${pkg.name} v${pkg.version}`

  if (pkg.author) {
    if (typeof pkg.author === "object") {
      banner += ` by ${pkg.author.name} <${pkg.author.email}>`
    } else if (typeof pkg.author === "string") {
      banner += ` by ${pkg.author.name}`
    }
  }

  banner += ` */`

  return banner
}
