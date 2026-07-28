import { Button } from "./button"

export default function ButtonPreview() {
  return (
    <div>
      <Button>Default</Button>
      <Button className="bg-secondary">Secondary</Button>
      <Button className="bg-destructive">Destructive</Button>
    </div>
  )
}
