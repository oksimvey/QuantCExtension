import { Class } from "./Class";
import { Method } from "./Method";
import { Variable } from "./Variable";

export interface StaticClass {
    
    identifier: string;

    comment: string;

    path?: string;

    methods: Method[];

    variables: Variable[];

    subclasses: Class[];
}
