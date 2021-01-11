let enabledCategories : any = {"*":true, "aiaworkflow":true}
var colorIndex = -1
var colorMap : { [key:string]:string }= {}

function getColor(cat:string) {
  let colors =
    [ "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173",
      "#3182bd", "#31a354", "#756bb1", "#636363", "#e6550d" ]
  if (colorMap[cat] == undefined) {
    colorIndex = (colorIndex+1)%colors.length
    colorMap[cat] = colors[colorIndex]
  }
  return colorMap[cat];
}

class Log {
  static message(level:string, category:string, msg:string, ...args:any[]) {
    if (level == "exception" || level == "error" || enabledCategories["*"] || enabledCategories[category]) {
      let dt = new Date()
      let p2 = (s:any) => s.toString().padStart(2, '0');
      let p4 = (s:any) => s.toString().padStart(4, '0');
      let prefix = ["[", p2(dt.getHours()), ":", p2(dt.getMinutes()), ":", p2(dt.getSeconds()), ":", p4(dt.getMilliseconds()), "] ", category.toUpperCase(), ": "].join("")
      let color =
        (level == "trace") ? "color:" + getColor(category) :
        (level == "exception") ? "color:#c00000" :
        (level == "error") ? "color:#900000" : "";
      console.log.apply(console, <any>["%c" + prefix + msg, color].concat(args))
    }
  }
  static trace(category:string, msg:string, ...args:any[]) {
    Log.message("trace", category, msg, ...args);
  }
  static exception(category:string, msg:string, ...args:any[]) {
    Log.message("exception", category, msg, ...args);
  }
  static error(category:string, msg:string, ...args:any[]) {
    Log.message("error", category, msg, ...args);
  }
}

// TODO: think about error-handling policy.
export function assert (b: boolean, msg?: string, ...xs: any[]): any {
  const msg_: string = msg || "Assertion failure"
  if (!b) {
     if (xs.length > 0) {
        console.warn("Assertion data:\n")
        xs.forEach(x => console.warn(x))
     }
     Log.error("assert", msg_)
     throw new Error(msg_)
  }
}

export { Log }