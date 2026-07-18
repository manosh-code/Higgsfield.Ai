
import "./index.css";
import { Button } from "./components/ui/button";


export function App() {
  return (
    <div  className="bg-black text-white  flex  justify-between">
      <div  className="p-4  text-xl">
        Higgsfield
      </div>
      <div>
        <div>
          <Button variant={"outline"}  className="flex  items-center">Signup</Button>
        </div>
        <div>
          <Button variant={"outline"}  className="flex  items-center">Signin</Button>
        </div>
      </div>
    </div>
  );
}

export default App;
