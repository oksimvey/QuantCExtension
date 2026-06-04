
import { ClassInstance } from "./ClassInstance";
import { Method } from "./Method";
import { StaticClass } from "./StaticClass";
import { Variable } from "./Variable";


export interface Class {

    identifier : string;

    comment : string;

    path? : string;

    asStatic : StaticClass;

    asInstance : ClassInstance;




}