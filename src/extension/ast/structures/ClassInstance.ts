import { Class } from "./Class";
import { Method } from "./Method";
import { Variable } from "./Variable";



export interface ClassInstance {

    identifier: string;

    comment: string;

    path? : string;

    extends : Class[];

    methods: Method[];

    variables: Variable[];

}