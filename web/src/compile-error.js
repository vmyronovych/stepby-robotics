export class CompileError extends Error {
 constructor(message,block){super(message);this.blockId=block?.id;}
}
