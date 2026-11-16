// Shared photo coordinates for the shunt model and its diagram hit target.
export const EXPANSION_JUMPER={x:28,top:-14,pitch:2.54};
export const jumperVoltage=component=>component.jumperVoltage??5;
export const jumperCenter=component=>({x:EXPANSION_JUMPER.x,y:EXPANSION_JUMPER.top-EXPANSION_JUMPER.pitch*(jumperVoltage(component)===3.3?.5:1.5)});
