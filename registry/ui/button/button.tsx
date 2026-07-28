import * as React from "react"

export function Button({ className, ...props }: React.ComponentProps<"button">) {
  return <button className={className} type="button" {...props} />
}
