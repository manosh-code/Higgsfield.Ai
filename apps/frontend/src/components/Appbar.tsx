

import { Button } from "./ui/button";


export function Appbar() {
  return (
    <div  className="bg-black text-white  flex  justify-between">
      <div  className="p-4  text-xl">
        Higgsfield
      </div>
      <div className="flex">
        <div className="flex items-center  p-2">
          <Button variant={"outline"}  className="flex  items-center">Signup</Button>
        </div>
        <div className="flex items-center  p-2">
          <Button variant={"outline"}  className="flex  items-center">Signin</Button>
        </div>
      </div>
    </div>
  );
}