// Web Serial cannot identify another tab or application holding the device.
// NetworkError is not proof of contention; classify it only at port.open().
export function usbConnectionIssue(error){
 if(!error)return {
  title:'Перевір інші вкладки',
  message:'USB-порт відкрився, але ESP32 не відповіла. Можливо, з’єднання з платою використовує інша вкладка або програма. Це не означає, що прошивка відсутня.',
 };
 if(error.code==='USB_TIMEOUT')return {title:'USB-з’єднання зависло',message:error.message};
 if(error.stage==='open'&&error.name==='InvalidStateError')return {
  title:'USB-порт уже відкритий',
  message:'Браузер повідомив, що цей USB-порт уже відкритий. Перевір, чи не працює з платою інша вкладка майстерні. Закрий інші підключення та повтори перевірку.',
 };
 if(error.stage==='open'&&error.name==='NetworkError')return {
  title:'USB-порт недоступний',
  message:'Не вдалося відкрити USB-порт. Можливо, його використовує інша вкладка або програма. Якщо закриття інших підключень не допоможе, перевір USB-кабель і вибір плати.',
 };
 return {title:'Відновімо зв’язок',message:'Не вдалося встановити USB-зв’язок із платою. Закрий інші підключення до неї та повтори перевірку. Якщо це не допоможе, перепідключи USB. Технічна причина — у діагностиці нижче.'};
}
