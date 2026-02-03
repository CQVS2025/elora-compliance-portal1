import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"

const Example = () => (
  <div className="relative w-fit">
    <Avatar>
      <AvatarImage alt="@dovazencot" src="https://github.com/dovazencot.png" />
      <AvatarFallback>DA</AvatarFallback>
    </Avatar>
    <span
      className="-bottom-1 -right-1 absolute size-3 rounded-full border-2 border-background bg-green-500" />
  </div>
)

export default Example
