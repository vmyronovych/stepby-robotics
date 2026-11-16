import source from './model-data.json' with {type:'json'};
// Photo-based teaching presentation. The old exported CAD/PDF stays a separately
// identifiable mechanical draft until the new boards have been measured.
const revisions={
 10:{title:'Плата розширення ESP32 38P',need:'Ваша фіолетова плата розширення • кріплення, підібрані вчителем',action:'Знайди гнізда ESP32 та кольорові ряди S/V/G. Натисни плату, щоб роздивитися контакти.',check:'Посадку, кріплення та положення перемички перевіряє вчитель.'},
 11:{title:'ESP32 · 38 контактів',need:'Ваш ESP32 • 2 ряди по 19 контактів',action:'Знайди антену та USB. Зістав підписи контактів ESP32 і гнізд плати розширення разом з учителем.',check:'3V3, GND і 5V збігаються з відповідними гніздами. Ширина посадки перевірена; контакти не загинаються.'},
 12:{need:'2 модулі DRV8833 HW-627 • наліпки D1 і D2',check:'Плати відтворено за вашими фото. Кріплення та підключення HW-627 ще потрібно перевірити; старі інструкції Pololu сюди не переносяться.'},
 17:{action:'Учитель перевіряє шлях живлення нової плати розширення та окремих гілок моторів перед підключенням.',check:'AA ще не вставлені. Напругу, полярність і перемичку перевірено на реальних платах.'},
};
export default {...source,steps:source.steps.map(step=>({...step,...(step.kind==='build'?revisions[step.stage]:{})}))};
