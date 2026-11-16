export const remoteCommands=['Вперед','Назад','Ліворуч','Праворуч','Блимнути','Танець','Кнопка 1','Кнопка 2'];
export function remoteEventId(block){
 const command=Number(block.getFieldValue('COMMAND'));
 const event=block.getFieldValue('EVENT');
 if(!Number.isInteger(command)||command<1||command>8||!['PRESS','RELEASE'].includes(event))throw Error('Обери команду та подію пульта.');
 return command+(event==='RELEASE'?8:0);
}
