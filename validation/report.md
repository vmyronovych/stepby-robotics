# Перевірка Мандрівника v0.3 — оновлення 15.10.2026

Це історичний журнал локальних перевірок різних версій. Посилання на журнали, JSON і знімки екрана ведуть до локальних артефактів, які не включаються до репозиторію; вони можуть бути відсутні після клонування. Актуальні автоматичні результати дивись у GitHub Actions, а порядок апаратного приймання — у [контрольному списку](bench-checklist.md).

**Програмні перевірки пройдено, справжні ESP32 `.bin` створено. Фізичний робот не підключався, апаратний допуск до занять ще не отримано.**

## Нова майстерня та прошивка

| Перевірка | Результат і межі |
|---|---|
| Компілятор Blockly | **17/17 PASS**: 13 тестів компілятора та 4 тести спільної 3D-моделі; справжні headless робочі поля Blockly: 4 приклади, цикли, умови, змінні, серіалізація, коротке обчислення AND, помилки входу. [Поточний результат](expansion-30p.json) |
| Виконавець MCAR2 | **PASS**, clang++ C++17 з Wall/Wextra/Werror: стек/гілки, тривалості, 4 мотори й боки, математичні межі, калібрування, обмеження інструкцій, 120 с, переповнення таймера. Виконано також 6 файлів, створених реальним JS-компілятором. [Лог](block-vm-test.log) |
| Базова C++ логіка | **PASS**, P-контролер, втрата/перехрестя, PWM, speed=0, плавний реверс, таймери. [Лог](control-test.log) |
| Браузерний інтерфейс | **10/10 PASS**, ізольований Chrome/Playwright: українські блоки, надсилання/ack, відмова запуску зміненої програми, STOP, збереження/помилковий імпорт, OTA інтерфейс, телефон 390 px, 3D-навігація, вибір деталей, анімація, збереження кроку, текстовий режим без WebGL, STOP при пізньому підключенні та робота завантаженого гайда офлайн. HTTP робота **замоканий**, справжнього Wi-Fi/flash тут немає. [JSON](workshop-e2e.json) |
| Production вебзбірка | **PASS**: відкривається, компілює блоки, жодного JS exception, жодного зовнішнього запиту, dev API відсутній. Перевірено desktop і phone. [JSON](workshop-production.json), [desktop](workshop-production-desktop.png), [phone](workshop-production-mobile.png) |
| Залежності | Точні версії в package-lock: Blockly 13.3.0, Three.js 0.186.1, Vite 8.3.4, Playwright 1.58.2. `npm audit` на дату перевірки: 0 знайдених вразливостей. Це не гарантія від усіх вад |
| Справжня ESP32 компіляція | **PASS**, Arduino-ESP32 **3.3.0**, `esp32:esp32:esp32:PartitionScheme=min_spiffs`, flash 4 МБ. Sketch **1 485 955 / 1 966 080 байтів (75%)**; статична RAM **48 300 / 327 680 (14%)**. Реальна heap під час Wi-Fi/OTA ще не виміряна. [Лог](esp32-build.log) |
| Application image | **1 486 096 байтів** з заголовками/вирівнюванням, ESP32 chip ID 0; checksum і validation hash перевірені esptool 5.0.0. Образ менший за OTA slot. [Лог](esp32-image.log) |
| Розділи та USB образ | Перевірено фактичний partitions.bin: app0 0x10000 / 0x1E0000, app1 0x1F0000 / 0x1E0000. USB merged 4 МБ містить той самий application на 0x10000; bootloader на 0x1000. SHA256 у [release](../firmware/release/manifest.json) |
| OTA реалізація | Код використовує `Update` / неактивний app, PIN, фізичне підтвердження, token, ліміти розміру, motor lock. Позитивний/негативний сценарій інтерфейсу перевірено з mock API. Реальний запис у flash, переривання Wi-Fi/живлення та поведінка bootloader **не випробувані** |

Образи зібрані, але **жоден пристрій не прошито**. Дані `Compile time`/`Project name` в esptool application info походять із Arduino core / prebuilt IDF і не є датою випуску Мандрівника; відбиток конкретного образу наведено в manifest.

## Інтерактивний гайд v0.3

- Геометрія оновлена під DevKit V1 30-pin та готову плату 30P. Усі **333 деталі / 13440 вершин поверхонь** порівняно з актуальним OBJ; 19 монтажних етапів звірено з page-manifest PDF. Джгути перевірено при підйомі верху.
- У гайді **23 кроки**, обертання/масштаб, ракурси, натискання на деталі, монтажна анімація, підйом верху та українські інструкції. Усі 23 production-стани відрендерено й оглянуто: [контактний аркуш](assembly-contact.jpg), [desktop](assembly-guide-desktop.png), [phone](assembly-guide-mobile.png), [вигляд сенсора знизу](assembly-guide-sensor.png).
- [Production-перевірка](assembly-production.json): WebGL працює, немає зовнішніх запитів або JS exceptions; dev API відсутній. Оновлений `web/scripts/check-production.mjs` також перевіряє відкриття 3D на desktop і phone.
- Без WebGL лишаються текстові кроки. При відкритті підключеного робота надсилається лише STOP; перевірено mock API, а не реальні мотори. Навігація не посилає команд руху. Збережений проєкт Blockly після виходу з гайда не змінюється.
- 3D-двигун, геометрія та схема включені у **14 локальних gzip ресурсів, 468 026 байтів**. WebGL виконується на комп’ютері/телефоні; ESP32 роздає файли. Після завантаження кроки працюють офлайн, перезавантаження сторінки з вимкненим сервером не підтримується.
- У PDF на сторінці 14 та в кроці 11 браузерного гайда встановлюється **готова плата розширення ESP32 30P**, у наступному кроці **DevKit V1 30-pin**. D1/D2/U2 показано на окремих ескізних опорах верхньої платформи; конкретні тримачі ще не підібрані й не спроєктовані. Геометрія показує 2×15 гнізд, 90 периферійних контактів, USB/DC і перемичку. Габарит основи 66×51 мм — із фото продавця; посадки не виміряні.
- Оновлено BOM, карту GPIO за написами Dxx/VP/VN, живлення через J5/Micro-USB, схему S/V/G і контроль перемички 3,3 В. Логіка й номери GPIO прошивки не змінилися. BOM 7513,20 грн/робот без спільної зарядки; нові тримачі та кабель враховані як оцінки.
- Відрендерено й оглянуто всі 31 сторінку PDF та 23 стани production-гайда. Окремо перевірені [нова плата на desktop](assembly-expansion-30p.png), [на телефоні](assembly-expansion-mobile.png), [вид зверху](assembly-expansion-top.png). Переповнень і JS exceptions немає. Фізична точність шасі, посадка пари плат і шлях USB-живлення ще **TBD**.


## Уточнення D1/D2

Крок 13 браузера та сторінка 16 PDF пояснюють: D1 — драйвер передніх моторів, D2 — задніх, обидва Pololu DRV8833 #2130. Невизначені тримачі вилучено зі списку деталей цього кроку. Опори прямо позначено як ескіз; монтажну анімацію цього кроку вимкнено. Додано видимі D1/D2 у 3D та PDF, конкретизовано назви при виборі деталей. Оглянуто оновлену сторінку PDF і production-крок на [desktop](assembly-drivers.png) та [телефоні](assembly-drivers-mobile.png); текст читається, JS exceptions немає. Повторно пройшли 17 модульних перевірок, перевірка документації та компіляція ESP32. Результати 10 браузерних сценаріїв вище збережені з попереднього етапу. Кріплення драйверів залишається відкритим механічним завданням.

## Документи й апаратний пілот

Збережені результати попереднього етапу: дослідження продавця/авторського опису відео, BOM без повторної купівлі шасі/моторів/коліс/відсіку, 17 унікальних GPIO, ADC1 для сенсорів/батареї, схема живлення, 31-сторінковий A4 PDF із вбудованим українським шрифтом та узгодженою демонстраційною 3D-моделлю. `tools/check_project.py` повторно звіряє GPIO, BOM, PDF, модель, 7 legacy-програм та локальні посилання.

PDF оновлено під електроніку 30P; сторінки програмного інтерфейсу стосуються `/control`. У всіх восьми уроках додані відповідники для Blockly v0.2. Механічні координати залишаються **TBD / illustrative**, не кресленням для свердління.

## Що ще потрібно перевірити на обладнанні

1. Отримане шасі: розміри пластин/отворів, висота відсіку, кріплення й кліренс сенсора. Фото продавця не підтверджує точні посадки.
2. Стартові/робочі/stall струми моторів, робота шунтів 0,25 Ω, контакти AA, температура, 5 В/3V3 при Wi-Fi та прискоренні. Проєктний ліміт 0,69–0,91 А/мотор не доводить упевнений старт конкретних моторів.
3. Реальні ADC/PWM/FAULT, кнопка, STOP, NVS, пауза реверсу, автономність і пороги батареї.
4. Завантаження Blockly з ESP32 без інтернету, доступна heap, реальний Wi-Fi OTA в обидва app розділи, збереження калібрування, переривання передачі, USB-відновлення. Автоматичного rollback після валідної, але несправної прошивки немає.
5. Покадрову відповідність відео не встановлено: конкретні невідомі компоненти й батарейна топологія лишаються позначеними в дослідженні.
6. Приймання одного зразка дорослим перед закупівлею партії та уроком. [Заповнюваний протокол](bench-checklist.md).

## Відтворення

З кореня:

```sh
npm ci --prefix web
npm test --prefix web
npm run test:e2e --prefix web
npm run build --prefix web
clang++ -std=c++17 -Wall -Wextra -Werror firmware/tests/control_test.cpp -o /tmp/mcar-control-test
/tmp/mcar-control-test
clang++ -std=c++17 -Wall -Wextra -Werror firmware/tests/block_vm_test.cpp -o /tmp/mcar-vm-test
/tmp/mcar-vm-test validation/block-fixtures/*.txt
sh tools/build_firmware.sh
python3 tools/package_workshop.py
python3 tools/check_project.py
```

ESP32 core 3.3.0/Arduino CLI і Chrome треба встановити за README. Для production-браузерної перевірки запустити Vite preview на 4173 та `node scripts/check-production.mjs` із папки `web`. Для PDF extraction потрібен `pypdf`; інакше статичний сценарій явно пропускає цей пункт. Старі `host-stubs`/`host-syntax.log` — історичний матеріал v0.1, не перевірка актуального firmware.

## Реальна пластина: 15.10.2026

Стару механічну 3D-схему відхилено після фото власника. 17/17 тестів вище підтверджують програмну узгодженість старої моделі, не її фізичну правильність. Повний посібник ще очікує перебудови.

Створено окрему карту за фото: 72 отвори, плоска сітка з 1407 трикутників; розбіжність суми площ від контуру мінус отвори < 0,000001 мм² (це числова перевірка сітки, не похибка вимірювання). Габарит нормовано до повідомлених 255 × 150 мм; спочатку товщина була null, після уточнення власника — 3 мм. Перевірено накладення на фото та обидві сторінки A4 PDF українською. Усі дані мають статус PHOTO_TRACE_NOT_MEASURED_CAD.

[Браузерна перевірка карти](chassis-review.json): перехід із гайда, 72 отвори, вибір клавіатурою, номери та масштабування на desktop 1440 і phone 390; JS exceptions відсутні. Після огляду телефону виправлено кнопку «Уся пластина»: карта вміщується за шириною екрана, прокрутка скидається. [Фото з накладенням](chassis-trace-overlay.png), [телефон](chassis-review-390.png). Фотографії не включені у flash ESP32; там лише векторна карта й HTML. Збірка ESP32 повторно пройшла; фізичний робот не підключався.

## Уточнені висоти корпусу

Власник повідомив t=3 мм і H=30 мм. У новому 3D-перегляді `/chassis-review.html` дві однакові пластини займають z=0…3 і z=33…36 мм. Усі 72 отвори проходять крізь товщину пластини; контур залишається оцінкою за фото. Нових опор/кріплень/батарейного відсіку не домальовано. [Перевірка](chassis-3d.json), [об’ємний вигляд](chassis-3d-1440.png), [вид збоку на телефоні](chassis-side-390.png), [нижня пластина зверху](chassis-top-1440.png). Оглянуто оновлені сторінки PDF; зазначено 3 + 30 + 3 = 36 мм.

Vite має два HTML входи й спільний Three.js chunk; CSS редактора ізольовано від сторінки корпусу. Production-перевірка підтвердила завантаження редактора й карти на desktop/phone, відсутність JS exceptions і переповнення сторінки. Повторно пройдено 17 модульних та 10 браузерних сценаріїв, компіляцію ESP32. Відсік потребує реального заміру з AA; попередній умовний габарит 62 × 64 × 30 мм не використовується як підтверджений.

## Виміряний відсік AA

Власник надав 62 × 58 × 18 мм зі вставленими AA та 10 фото. Вимір збережено в battery-measurements.json; невідомі товщини стінок і координати отворів не моделювалися. У новому перегляді відсік — синій габарит у пробному центральному положенні. Перевірено фактичні межі Three.js: x=−29…29, y=−31…31, z=3…21 мм; до низу верхньої пластини залишається 12 мм. Це не підтверджує місце між моторами, кріплення або можливість заміни AA без зняття верху.

[Перевірка габариту](battery-envelope.json): кути прямокутника всередині зовнішнього контуру, його ребра не перетинають межу пластини. Внутрішні отвори не вважаються опорною поверхнею; міцність і монтаж не перевірені. Браузерна перевірка на 1440 та 390 px підтвердила межі габариту, 12-мм запас, приховування/показ у 3D та 2D, збереження 72 отворів, відсутність JS exceptions і горизонтального переповнення. [Примірка](battery-3d-1440.png), [вигляд збоку](battery-side-390.png). Оглянуто обидві сторінки PDF, у тому числі масштабований вид збоку. Повторно пройдено 17 модульних перевірок, статичні перевірки документації й компіляцію ESP32. Повний старий монтажний посібник залишається відхиленим.


## Відсік під платформою — результат фізичної примірки

Власник відхилив центральне розміщення між пластинами: відсік не поміщається. Наступне фото й повідомлення підтвердили посадку під нижньою платформою та відсутність торкання підлоги. Попередні 12 мм арифметичного запасу не є доказом сумісності. Фото збережене як `assembly/references/battery-2026-10-15/11-under-platform-fit.png`.

Обране компонування B внесено в документацію, карту й 3D. Точні XY, орієнтація, монтажний відступ і кліренс у мм залишаються невиміряними; центральне положення у перегляді схематичне. Відсік не має вигаданих отворів або гвинтів. На фото примірки він порожній; перевірка з AA й остаточним кріпленням ще потрібна.

[Браузерна перевірка](battery-underside.json): 1440/390 px, кнопка «Знизу», перемикання відсіку в 3D/2D, 72 отвори, без JS exceptions та горизонтального переповнення. Виміряні межі візуалізації z=−18…0 мм; це не значення кліренсу. Оглянуто [мобільний вигляд](battery-underside-390.png), вигляд збоку та дві сторінки PDF. 17/17 модульних перевірок, статична перевірка проєкту й компіляція ESP32 пройдені. 14 gzip-ресурсів займають 468 624 байти. Пристрій не прошивався; старий повний посібник залишається відхиленим.


## Двосторонній скотч і кліренс 3–4 мм

Власник повідомив зазор 3–4 мм, незбіг отворів із прорізами й рішення кріпити відсік двостороннім скотчем. Дані внесено в джерела та документацію. Товщина й площа стрічки невідомі; модель не вигадує шар кріплення чи остаточний кліренс. Додано п’ять кроків монтажу й контроль зі вставленими AA, зняття захисної плівки перед приклеюванням та пробний рух по рівній поверхні. Повний архівний посібник не перебудовувався; карта для звірки тепер має три сторінки, включно з текстовим порядком кріплення.

Перевірено мобільний/настільний перегляд, 5 кроків, збереження діапазону 3–4 мм окремо від невідомого остаточного зазору, відсутність JS exceptions/overflow: [результат](battery-tape.json). Оглянуто змінені PDF-сторінки й мобільний крок. Вебресурси: 14 файлів, 469 430 байтів gzip; ESP32 компіляція пройдена. Приклеювання, утримання та рух фізично не випробувані агентом.

## Перебудова повної машинки на уточненому корпусі — 10.11.2026

Поточні браузерні сцени, 31-сторінковий PDF, OBJ і маніфести використовують `chassis-photo-trace.json` та `chassis-planar-mesh.json`. Нижня пластина z=0…3 мм, верхня z=33…36 мм; 255 × 150 мм, 72 наскрізні отвори в кожній. Виявлено колінеарне ребро, яке триангулятор пропускав як проміжні вершини: після розділення сітка має 1409 трикутників на поверхню, похибка суми площ 1,82×10⁻¹¹ мм². Це числова перевірка, не оцінка похибки фото.

Відсік використовує виміряний габарит 58 × 62 × 18 мм по x/y/z та демонстраційне положення з уточненого перегляду, z=−18…0. Старі ремінці, вигадані стінки й розміщення між пластинами прибрано. Кроки описують скотч, встановлення AA знизу й перевірку остаточного зазору. Камера відсіку та AA автоматично переходить униз; верх не підіймається для батарей. Окремий огляд електроніки з підйомом лишається доступним. Позиції моторів/коліс, опор і переднього кронштейна пристосовано до нового контуру як схематичні, без заяви про виміряні посадки.

Перевірки цієї версії:

- `npm test --prefix web`: 19/19. Перевірено габарити, товщину й проміжок пластин, відкритість 72 отворів, два суміжні грані на кожне ребро замкненої оболонки, габарит відсіку, AA всередині, повну відповідність вершин OBJ та вебмоделі й контрольні суми джерел.
- `npm run test:e2e --prefix web`: 11/11. Desktop 1440 × 950 і phone 390 × 844: навігація, анімації, збереження, підйом, автоматичний вигляд знизу, відсутність JS exceptions і горизонтального переповнення. Нові знімки — `rebuilt-desktop-*.png`, `rebuilt-mobile-*.png`; поточний машинний звіт — `workshop-e2e.json`.
- `npm run build --prefix web`: 14 автономних ресурсів, 544 507 байтів gzip. Обидва перегляди включені у збірку; браузерні сценарії запускалися на dev-сервері, окрему production-браузерну перевірку цього разу не виконували.
- PDF: оглянуто всі 31 сторінку, після остаточної правки проводки повторно сторінки 23–24; текстові перевірки A4, шрифту та номерів сторінок пройдено. `tools/check_project.py` також пройдено.
- ESP32 / Arduino core 3.3.0: цільова компіляція пройдена, 1 561 027 / 1 966 080 байтів flash (79%), 48 300 / 327 680 байтів RAM (14%). Через обмеження запису в системний кеш CLI використано `--build-path /tmp/mcar-esp32-build --build-cache-path /tmp/mcar-esp32-cache`; у журналі залишаються попередження про застарілі API core та прапорець кешу.

Пристрій не прошивався. Остаточні XY кріплень, орієнтація відсіку, товщина скотчу й кліренс не виміряні. Статуси PHOTO_TRACE_NOT_MEASURED_CAD та ILLUSTRATIVE_NOT_FOR_MANUFACTURE збережено. Старі архіви `exports` та готові `firmware/release` не перевидані; нова збірка знаходиться в `firmware/build`.

## Повноекранна демонстрація 3D — 10.11.2026

Обидва перегляди мають кнопку «На весь екран»: повна машинка (`/#assembly`) та уточнений корпус (`/chassis-review.html`). Режим розгортає модель з її керуванням. Вихід кнопкою або Esc відновлює прокрутку й фокус; у гайді зберігаються поточний крок і піднятий верх. STOP доступний і в повноекранному гайді. За відсутності Fullscreen API або відмови браузера використовується вся область вікна. Закривання гайда скасовує незавершений запит на повний екран.

`npm test --prefix web`: 24/24, включно з 5 новими DOM-тестами керування станом (JSDOM). Вони симулюють події API; це не перевірка браузерного Fullscreen API чи фактичної CSS-геометрії. `npm run build --prefix web` пройдено: 15 автономних ресурсів, 546 162 байти gzip, оновлений `workshop_assets.h`.

Браузерна перевірка не завершена. Dev-сервер був відсутній, його запуск повернув `listen EPERM`. Додано `playwright.static.config.js`, який перевіряє готовий `dist` через перехоплення запитів без HTTP-порту. Проте Chrome завершився з `SIGABRT` під час запуску, до виконання всіх 7 сценаріїв. Деталі — `fullscreen-e2e.json`; свіжих скриншотів повноекранного режиму немає. Підготовлено перевірки нативного й резервного режимів, відмови API, повернення з Esc/кнопкою, збереження стану та розмірів 1440×950, 390×844, 844×390.

Для повторення у середовищі з доступним Chrome: `npm run test:e2e --prefix web -- --config playwright.static.config.js`. PDF та геометрія не змінювалися; прошивка з новим повноекранним UI цього разу не компілювалася й на пристрій не записувалася.

## Drill-down компонентів і розпіновка — 10.11.2026

Клік по компоненту або 3D-мітці D1/D2 відкриває картку всередині області моделі. Вона містить призначення, характеристики, інтерактивні групи контактів, повну таблицю підключень і переходи до пов’язаних вузлів. Додано список «Деталі компонента», що відповідає видимим деталям поточного кроку. При зміні кроку картка закривається; вибір контакту або перехід D1 → D2 не змінює монтажного етапу. Кнопка повернення та Esc закривають картку перед виходом із резервного повноекранного режиму. На уточненій моделі доступні картки корпусу та відсіку.

Каталог охоплює D1, D2, використані GPIO ESP32, плату 30P, QTR, U2, BT1, чотири мотори, кнопку, вимикач і корпус. Для D1/D2 — 15 унікальних назв контактів: керування, моторні виходи, живлення та струмові шунти. Карта функціональна, фізичний порядок ніжок не заявляється. Функції DRV8833 звірено з https://www.pololu.com/product/2130/; конкретні GPIO, джгути й моторні роз’єми походять із документації проєкту. Тест звіряє GPIO та FAULT безпосередньо з `firmware/src/config.h`. SLP лишається непідключеним, FLT має підтягування до 3V3, VMM позначено як силове живлення після захисту, а не логічне VCC.

`npm test --prefix web`: 29/29. П’ять нових перевірок охоплюють відповідність розпіновки, зіставлення піддеталей D1/D2, вибір контакту, перехід до D2 без застарілих даних, дворівневий Escape і збереження фокуса. Це перевірки даних і DOM, не візуальний огляд. `npm run build --prefix web` пройдено: 15 ресурсів, 554 213 байтів gzip. Вебресурси та `workshop_assets.h` оновлено; прошивка цього разу не компілювалася й пристрій не прошивався.

Браузерні сценарії підготовлено у `components.spec.js`; запуск через `playwright.components.config.js` зупинився до тестів: сервер недоступний із тестового процесу, спроба запуску повернула `listen EPERM`. Окрема спроба UI-перевірки повернула «browser access host is unavailable». Нових знімків екрана немає, візуальна перевірка не завершена.

## 10.11.2026 — photo-based module drill-down (HW-627 / ESP32 38P)

Implemented procedural Three.js models from the user-supplied photos: black HW-627 with 12 plated contacts and component/solder sides; ESP32 with 38 physical contacts; purple 38P expansion with socket variants and S/V/G headers; yellow geared motor with selectable red/black cable ends. Photos are preserved under `assembly/references/` and excluded from firmware assets. Dimensions are photo proportions, not measured CAD.

The component panel now starts with a rotatable module and one short visual explanation after selection. Related destinations are clickable; teacher data and complete pin tables are collapsed. Physical pins support ray picking, projected accessible buttons, a keyboard picker, and S/V/G filtering. Markers scale with projected pitch so adjacent contacts do not intercept one another. Direction arrows distinguish incoming commands/power from outgoing connections. WebGL failure uses an explicitly labelled 2D contact map. Renderers and geometry/textures are disposed on close/switch.

The main assembly uses the new electronic surfaces at approximate existing mounting positions; presentation steps now describe 38P and HW-627. The shared exported mechanical base and old PDF/OBJ remain separately identified legacy drafts. Old 30P/Pololu wiring and current-limit instructions are not verified for the new hardware; GPIO assignments remain proposals matching the existing firmware. Motor voltage/current/gearing are not established from its photo. Supplier pages were unavailable, so no missing product specifications were invented.

Validation:
- `npm test` in `web`: **34 passed**, covering photo pin order, mirrored solder view, 38 separate ESP32 contacts, every physical model contact ray-pick, firmware GPIO proposals, panel navigation/disposal/Escape, fullscreen state and existing compiler/mechanical checks.
- `npm run build` in `web`: passed; **15 embedded assets, 568,745 compressed bytes**.
- `npm run test:e2e -- --config playwright.modules-static.config.js` in `web`: **5 passed, 1 skipped** on the final build. Covers physical pin clicks across all four model types, teacher panel collapsed by default, related navigation, step changes, native fullscreen, mobile viewport presentation/Escape, chassis cards and WebGL-unavailable fallback. The skipped test relies on dev-only projection diagnostics for the D1 badge; static production has no such diagnostics.
- Screenshots inspected: `module-D1-fullscreen.png`, `module-D1.png`, `module-ESP32.png`, `module-30P.png`, `module-M1.png`, `component-d1-mobile.png`, `assembly-photo-modules.png`. Dense pin overlap and default-panel cropping found during the initial run were corrected before the passing final run.
- One intermediate invocation of Chrome failed at launch with SIGABRT; subsequent direct test invocations from `web` succeeded. Latest machine-readable browser report: `modules-e2e.json`.
- No physical robot, electrical current limit, real mounting fit or flashed firmware verified in this task.

## 12.11.2026 — standalone USB LED blink preparation

User confirmed only the ESP32 is connected, with no expansion board, drivers or batteries, and requested a blinking LED firmware test. USB inventory identifies a Silicon Labs CP2102 at `/dev/cu.usbserial-0001`; this identifies the USB bridge, not the MCU silicon. The read-only esptool `chip-id` attempt failed to open the device with errno 1 (`Operation not permitted`). No upload or erase was attempted by the agent.

Created `firmware/blink/blink.ino`: GPIO2 HIGH/LOW every 500 ms, startup marker, chip/flash metadata and numbered serial transitions at 115200 baud. GPIO2 is a candidate for the board LED, not a confirmed schematic assignment. Compiled with installed Arduino-ESP32 3.3.0: 300495 bytes flash, 20696 bytes RAM; only an upstream deprecated touch API warning. Shell/Python syntax checks passed for `tools/test_blink.sh` and `tools/monitor_blink.py`. The script builds/uploads this isolated sketch and checks consecutive on-device serial transitions with 450–600 ms spacing. Visual confirmation of actual light remains necessary. Firmware source/build for the robot was not replaced.

Status: compilation passed; physical flashing, chip identity, runtime and LED behavior await a user-run terminal command because the agent cannot open the USB device in this environment.

## 12.11.2026 — USB permission granted; Blink flashed and runtime verified

After the user changed session permissions and approved USB commands, esptool connected to ESP32-D0WD-V3 rev. 3.1. The approved `sh tools/test_blink.sh` rebuilt and uploaded the standalone Blink sketch at 115200 baud. Bootloader, partition table, boot_app0 and application writes each passed hash verification. The board booted `MCAR_BLINK_ONLY v1` and reported 4194304 bytes of flash. Serial monitoring captured ticks 1–12 from 1009 through 6509 ms, alternating GPIO2 HIGH/LOW with exactly 500 ms between each sample; the monitor returned PASS with exit code 0. The port was closed after monitoring. This supersedes the previous USB-access block. Logs: `blink-upload.log`, `blink-serial.log`. Physical light output awaits the user’s visual confirmation; serial messages do not establish optical behavior.

## 12.11.2026 — Blink visual confirmation: PASS

The owner confirmed that the on-board LED is blinking after the GPIO2 Blink upload. Together with the verified flash write and 12 serial transitions at 500 ms intervals, this completes the standalone USB/LED test on this specific ESP32-D0WD-V3 board. GPIO2 is now confirmed as controlling its on-board LED. Active-high versus active-low polarity was not determined. The Blink firmware remains running; no further upload was needed.

## 12.11.2026 — local Blockly USB workshop: PASS

Added `/usb.html`: Ukrainian Blockly editor, LED/delay/control/logic/variable blocks, examples, local project persistence, `.mcar` save/open, Arduino preview and a single «Прошити» button. A localhost-only Vite service validates the graph, compiles a standalone sketch with the installed Arduino CLI, uploads through the selected USB port and checks startup over Serial. Requests require a session token and same-origin/loopback checks; arbitrary source, shell commands and non-enumerated ports are rejected. Concurrent jobs are locked and subprocesses have timeouts.

Validation:
- `npm test --prefix web`: **42 passed**.
- USB Playwright suite: **3 passed**, including edited program submission, persistence, invalid input, missing USB and narrow-screen layout.
- `npm run build --prefix web`: passed; **18 embedded assets, 569,289 compressed bytes**. USB-only page/scripts/styles are excluded from the robot's embedded assets.
- Actual browser-button hardware test: compile → upload → verified flash hashes → reset → `MCAR_USB_BLOCKS BOOT` → 12 alternating `LED2=ON/OFF` messages, 500–501 ms apart. No browser page errors. Evidence: `usb-blocks-hardware.json`, `usb-workshop-hardware.png`. This replaces the earlier standalone Blink with the program generated from Blockly.
- Desktop and final mobile screenshots inspected: `usb-workshop-desktop.png`, `usb-workshop-mobile.png`.
- Opened the application in the owner's Chrome and observed the editor, `USB знайдено`, selected `usbserial-0001` and enabled «Прошити» button. Local development server remains running on `127.0.0.1:5173`.

Current USB support targets this Mac and the confirmed GPIO2 LED. Motors, arbitrary GPIO and Wi-Fi commands are not included. The bounded startup monitor checks the beginning of execution, not the correctness of an entire arbitrary program. No new optical confirmation was requested; the preceding owner confirmation establishes the LED pin. Usage and restart instructions: `docs/usb-workshop.md`.


## 12.11.2026 — USB workshop progress UX redesign

Replaced the faded busy action with a high-contrast locked action and a persistent status card: elapsed time, preparation/upload/startup stages, indeterminate compilation activity, per-image upload percentage from esptool output, distinct success/warning/error states and edited-since-submit messaging. Added server job timestamps and failed-stage metadata. The parser handles output split across chunks and resets percentages for each image; these are explicitly not overall-operation percentages. Connection errors stop progress animation and block new submissions. Local block validation errors persist across status polling until edits or retry.

Reduced the board illustration to a separate grid cell beside its caption, removed its simulated LED glow, collapsed USB settings and added “Уся програма” to fit the Blockly graph. Preserved the existing local project format and storage key.

Validation: **43 unit/service tests passed**, **4 browser scenarios passed**, production build passed (**18 embedded assets, 569,289 compressed bytes**). Browser scenarios cover busy-button contrast, a long compilation, upload percentage, verification, success, edits during upload, connection loss, fitting the program, project persistence and mobile layout. Reviewed `usb-workshop-compiling.png`, `usb-workshop-uploading.png`, `usb-workshop-desktop.png` and `usb-workshop-mobile.png`. Progress tests use mocked USB jobs; no hardware upload was performed for this UX change.

The owner's Chrome still has the local USB workshop selected; reload was requested through the native UI. Native screen capture returned a blank surface and the accessibility tree exposed browser chrome only, so the final visual check used the successful automated Chrome screenshots instead. Local server remains available at http://127.0.0.1:5173/usb.html.


## 12.11.2026 — classroom Web Serial implementation (pilot candidate)

Implemented a default browser-only USB path for desktop Chrome/Edge. Blockly compiles locally into MCARUSB1 instructions; esptool-js writes the bootloader, partition table, generic LED runtime and the student's program partition. No localhost API, Arduino CLI, account, or compiler service is used by this path. The existing C++ service remains opt-in through `?transport=local`. Project serialization/storage stays compatible.

Added a bounds-checked C++ interpreter with CRC and control-flow stack validation, autonomous boot execution, safe finite arithmetic, short-circuit logic, eight user variables, bounded repeat counts and cooperative loop yielding. Packaged ESP32/4-MB binaries include source/file SHA-256 manifest entries. Only classic ESP32 is accepted before flash writes; other chip families and undersized flash are rejected. Every flash image is checked against on-device MD5, and success requires a boot marker matching the new program CRC. The browser shows permission selection, transfer progress, retry guidance, unsupported-browser and driver help. Explicit RTS assertion fixes the esptool-js 0.7.1 HardReset release-only behavior.

Static packaging (`npm run build:site`) uses the USB editor as index, preserves the 3D guide at `robot.html#assembly`, uses relative resource paths and includes the firmware package. A GitHub Actions workflow builds/tests and supports explicit manual Pages deployment. No GitHub repository exists in this folder and no remote publication was performed; repository URL requested from the owner.

Verification:
- `npm test --prefix web`: **49 passed**, including native C++ execution of generated bytecode, corruption/unsafe-jump rejection, variables/while/repeat/if, short-circuit behavior, manifest/source integrity, wrong-chip rejection and flash/reset/boot contract tests.
- Browser static-site suite: **4 passed** under HTTPS `/mcar/`, including browser permission mocks, cancellation, unsupported browser, absence of local API requests, real flasher module load, shipped firmware checksums and nested-path 3D navigation.
- Existing local USB browser suite: **4 passed**. Production and static-site builds passed. `npm audit --omit=dev`: zero reported vulnerabilities. This is dependency-audit output, not a full security audit.
- Real connected ESP32-D0WD-V3: production esptool-js wrote all four images and verified their hashes, reset the board, then read `MCAR_BROWSER_V1 BOOT e3bdc0cc` and alternating GPIO2 events. Test adapter uses Python only to supply serial streams to esptool-js; **this is not a real Web Serial permission/Windows test**. Evidence: `esptool-js-hardware.json`. A subsequent serial observation again saw the matching boot marker and twelve alternating events at 501–502 ms (`browser-runtime-serial.log`); boot output includes a non-fatal missing core-dump-partition message. Test firmware with 0.5-second LED waits remains on the connected board.
- The fully browser-native hardware attempt stalled at the operating-system serial chooser before any write. Native Chrome inspection exposed no page controls and returned a blank screenshot surface, preventing an interactive chooser test. No successful real browser-to-board claim is made.
- Screenshot: `browser-usb-static.png` (mocked transport, real production UI).

Outstanding release gates: actual Chrome/Edge chooser and USB end-to-end test, Windows 10/11 student-account/driver/policy acceptance, simultaneous multi-PC classroom smoke test, and publication to the chosen GitHub repository. Instructions: `docs/classroom-web-usb.md`. The preview on http://127.0.0.1:4173 serves only static files and remains running; development server on 5173 also remains available.

## 12.11.2026 — graphical ESP32 pin programming

The board card now opens a large interactive 38-contact 3D pinout using the existing photo-based ESP32 model and the same physical pin order. Labels are always visible and clickable; front/back views, rotation, keyboard selection, a WebGL fallback and a narrow-screen layout are supported. Selecting a Blockly pin block highlights the corresponding contact when the pinout is opened.

Five actions create connected Blockly blocks: digital output, 8-bit / 5-kHz PWM, digital input, active-low button with internal pull-up, and raw 12-bit ADC. Input actions create an if statement or sensor variable so a child receives a usable program fragment. Insertion preserves following blocks, respects the forever-loop body, participates in undo and survives save/reload. GPIO34/35/36/39 cannot be outputs or use pull-ups; UART0/flash/power/reset contacts are explanatory only; boot-strapping pins have visible notices. Invalid imported GPIO fields are rejected before Blockly can replace them with defaults.

Both C++ generation and browser bytecode support the actions. The VM independently validates pin capabilities, stack effects and PWM values. Shared Arduino GPIO helper source handles PWM attachment/detachment, digital/analog modes and output shutdown on error. The new `esp32-gpio-v1` package was compiled with Arduino-ESP32 3.3.0; runtime binary is 322,576 bytes. The source manifest includes the shared helper and generated header. There is no live input/output telemetry: actions execute after flashing.

Validation:
- **52 unit/service/native tests passed**, including execution of GPIO programs by the real C++ VM with deterministic test I/O, all five operation capabilities across pins −1…40, invalid PWM, invalid imported fields, and packaged firmware source/file integrity.
- **10 browser scenarios passed**: two new graphical-pin scenarios, four existing local USB scenarios, and four static HTTPS `/mcar/` scenarios. Covered output/input insertion, generated code, selected-pin synchronization, undo, reload, reserved pins, mobile label bounds, Escape/focus return and real lazy 3D loading under a nested deployment path. Static-site flashing still uses mocked permission/transport.
- ESP32 firmware compilation, normal embedded build (**19 assets, 571,225 compressed bytes**) and static-site build passed. Added the pin browser suite to Pages CI.
- Reviewed `usb-pins-desktop.png` and `usb-pins-mobile.png`; corrected clipped mobile SP/SN labels and Blockly creation-event undo behavior during verification.
- No physical board was reflashed for this change, and GPIO/PWM/ADC electrical behavior has not been measured on hardware. Existing classroom release gates above remain applicable.

The local app responds at http://127.0.0.1:5173/usb.html. Opening that URL in the owner's Google Chrome via macOS `open` succeeded. Browser-control host was unavailable, so native Chrome rendering was not independently observed; visual verification used automated Chrome screenshots. The final `web/dist` is the static classroom build.

## 12.11.2026 — investigation of repeated manual BOOT requirement

Owner reports needing BOOT for each upload. Added the non-flashing diagnostic `node web/scripts/check-auto-boot.mjs 3`, reusing the existing test serial bridge (now extracted into `web/scripts/serial-test-port.mjs`). It invokes the installed esptool-js `ESPLoader.connect('default_reset', 2)`, checks the detected chip is ESP32, then resets back into the existing application. It performs no flash writes.

Observed on `/dev/cu.usbserial-0001`: **PASS 1/3, PASS 2/3, PASS 3/3**, without a BOOT-button request. The system serial/adapter path therefore supports automatic boot on this board. This does **not** reproduce or resolve the owner's Chrome-specific symptom; the bridge uses a combined modem-control ioctl and does not prove browser/driver signal timing is equivalent. Both installed and Vite-prebundled ClassicReset code already issue DTR/RTS reset signals. No production reset behavior was changed on the basis of this passing diagnostic. Requested the actual workshop URL and failure log without BOOT to reproduce the reported path. Script syntax checks passed; user's flash contents were not replaced.

### Follow-up: reproduce the browser signal-order failure

The owner supplied the browser log: CP210x VID 0x10c4 / PID 0xea60, `Connecting...`, `Failed to connect with the device`. Corrected the earlier bridge comment: a single Web Serial `setSignals` call does **not** guarantee an atomic hardware update. Chromium's [POSIX split-DTR/RTS implementation](https://chromium.googlesource.com/chromium/src/+/refs/tags/142.0.7444.20/services/device/serial/serial_io_handler_posix.cc#468) performs a DTR ioctl followed by an RTS ioctl.

Added an explicit `chromium` bridge mode using those separate TIOCMBIS/TIOCMBIC operations. On the same connected board, `node web/scripts/check-auto-boot.mjs 3 chromium` failed **3/3** with the owner's exact connection error (`auto-boot-chromium.log`). Repeating `node web/scripts/check-auto-boot.mjs 3 atomic` succeeded **3/3** (`auto-boot-atomic.log`). This isolates a concrete board/driver interaction with sequential control-line changes; it is still a reproduced Chromium-style path, not an observed native browser hardware run. Testing RTS-release-before-DTR-assertion and extending reset assertion from 100 to 500 ms each failed too. No flash writes or production reset patches were made.

Two viable directions presented to the owner: a persistent runtime receiving verified block programs over serial (one-time runtime installation, subsequent algorithm updates bypass the ROM bootloader), or hardware stabilization of auto-reset. Espressif documents a 1–10 µF EN-to-GND capacitor for reliable auto-reset on suitable boards; this physical change has not been performed or tested here. Requested preference because these alternatives change different parts of the teaching workflow. The persistent upload protocol is a proposed follow-up, not an implemented capability.

## 12.11.2026 — persistent runtime and USB algorithm updates without BOOT

Owner selected the persistent-runtime approach. Implemented the MCAR2 serial receiver and browser client: probe the running firmware, transfer acknowledged chunks, validate the entire MCARUSB1 algorithm, save it and start it without entering the ROM bootloader. Normal updates do not construct the ROM loader or fetch firmware images. Initial installation/version upgrade/recovery still uses esptool-js; the UI distinguishes that path and exposes explicit reinstallation under connection settings. A failed transfer to a recognized receiver never silently falls back to a ROM flash.

The 64-KB program partition now has two 32-KB slots. The inactive slot is erased/written/read back and its generation/CRC footer is committed last. Boot chooses the latest fully valid slot; the legacy image at offset zero migrates on first update. The old VM keeps running while receiving/validating a transfer. Outputs stop when a verified new program replaces it. The receiver stays available after normal completion or runtime errors. The browser requires nonce/CRC-matched SAVED/RUNNING replies and observes the first 750 ms of execution for immediate errors; this is not full algorithm verification.

Verification:
- Native C++ storage tests exercise power interruption during erase, payload and footer writes, invalid programs, footer corruption, legacy migration and fallback. Protocol tests cover bounds, incomplete/malformed transfers, cancel and inactivity timeout. Browser-client tests interoperate with the **real C++ receiver**, including a maximum-size 16,400-byte / 65-chunk algorithm, corrupt transfer, missing RUNNING reply and immediate runtime failure.
- **58 unit/service/native tests passed**. **11 browser scenarios passed** (5 static HTTPS, 4 legacy local USB, 2 pin editor), including two consecutive updates through the real browser client with simulated serial streams and zero firmware/API requests. Reviewed `runtime-upload-browser.png`.
- ESP32 package `esp32-gpio-v2` compiled successfully: runtime binary 325,920 bytes, static RAM 104,064 bytes. Source and binary hashes verified. Normal embedded and static-site builds passed.
- Installed the new runtime on the owner's real ESP32 after backing up its entire program partition to `program-before-runtime-v2-1794510109669.bin`. Preserved the original algorithm checksum **faadf342**. Installation verified flash hashes and the matching boot marker (`runtime-v2-install.json`, `runtime-v2-install-console.log`).
- Real ESP32 updates using the **Chromium-style sequential-signal test adapter**: blink **e3bdc0cc** in **2,881 ms**, pulses **faadf342** in **2,901 ms**, original **faadf342** in **2,873 ms**. All used `mode: algorithm`, with no ROM fallback or BOOT intervention. A subsequent simulated cable loss immediately before COMMIT returned an error; reopening/resetting the board confirmed **faadf342** still boots (`runtime-v2-hardware.json`). The owner's original program remains on the board.
- These hardware results do not exercise the native Chrome permission/driver implementation end to end. Chrome's existing local-workshop tab was reloaded through the native UI, but screen capture remained blank and accessibility exposed only browser chrome, so clicking/observing its upload action was unavailable. Owner was asked to try the final button without BOOT. Windows 10/11 classroom acceptance is still pending.

Protocol/build instructions: `firmware/browser/README.md`; teacher/student flow: `docs/classroom-web-usb.md`. Development remains available at http://127.0.0.1:5173/usb.html; final static build at `web/dist` supports Pages hosting. No remote deployment was performed.

## 12.11.2026 — guided first setup for another ESP32

Replaced automatic ROM fallback after a silent/incompatible runtime probe with a finished `setup-required` state. No firmware package is fetched and no ROM connection is attempted until the user follows the visible three-step BOOT guide and clicks its installation action. A separate probe-again action supports previously prepared boards without assuming silence means missing firmware. Manual reinstallation opens the same guide. Selecting another port or losing the selected port clears the pending setup state.

During installation the card explicitly says to hold BOOT, then release it when writing begins. Failed ROM connection / wrong boot mode returns to the guide with BOOT/EN retry instructions and states that writing has not begun. Port access, firmware download, chip compatibility and write errors retain their specific error handling. Existing runtime updates remain one click without BOOT.

Validation: two new regression tests failed on the old implementation and passed after the change; **60 unit/native/service tests passed**. **8 static browser scenarios and 4 legacy local USB scenarios passed**. The actual browser probe/client was tested against simulated legacy `LED2=ON/OFF` serial output, confirming guidance and zero firmware/API requests. Guided installation/retry/release UI transitions use a simulated flasher; no physical board was changed in this UI task. Reviewed `usb-setup-retry.png` and `usb-setup-mobile.png`, with no horizontal overflow. Both embedded and static-site builds passed; `web/dist` remains the static build. Native Chrome hardware and Windows classroom acceptance remain separate from these automated tests.

## 12.11.2026 — connection-driven workshop screens

The browser USB workshop now starts with a full-page animated micro-USB/ESP32 illustration and a single connection action. The editor is hidden and inert until a compatible runtime answers a HELLO-only readiness check. First-use permission remains an explicit browser chooser action. Already authorized ports are discovered on load/reconnect via Web Serial events and enumeration; a silent/old runtime leads directly to the guided BOOT setup screen. The existing installation card/log move into that screen instead of maintaining duplicate controls. Normal algorithm transfer also gets its own screen and returns to the editor on completion.

Disconnect immediately hides tools, closes open dialogs, saves the project and invalidates pending readiness/upload results. Reconnect rechecks readiness without changing the algorithm. Cancellation, unsupported browsers and port-access problems have focused recovery screens. Initial setup installs a known blink example independently of the saved workspace, so incomplete blocks cannot prevent preparation of a new board; saved blocks remain unchanged and the completion message identifies the blink test. Legacy `transport=local` mode retains its existing flow.

Validation: **61 unit/native/service tests passed**, including HELLO-only probing against the real native C++ receiver. Browser suites cover **10 static USB scenarios, 4 legacy local USB scenarios, and 2 pin-editor scenarios**. Added automatic reconnect/project preservation, disconnect during a pending probe (stale-result exclusion), first setup with an incomplete saved project, hidden/inert tools, transfer screen, mobile bounds and reduced-motion handling. Serial streams and connection events are simulated in browser tests; no physical board was flashed for this UX change. Both embedded and static builds passed. Reviewed `usb-connect-desktop.png`, `usb-connect-mobile.png` and the setup screen; the mobile capture was repeated after viewport layout settled. No remote deployment performed.

Web Serial permission/event behavior follows the official Chrome documentation: https://developer.chrome.com/docs/capabilities/serial . Native Chrome USB hardware and Windows classroom acceptance remain separate release checks.

## 12.11.2026 — GPIO2 algorithm versus visible board indicator

Owner reported no visible blink from GPIO2 ON → wait 2 s → OFF → wait 2 s, while the LED block produced short flashes. Recreated the exact screenshot program: **104 bytes, CRC 6484ebdf**. Native VM execution alternated GPIO2 correctly. A real-board reset log confirmed the same program boots with no PROGRAM_ERROR. Read back the installed runtime and confirmed it byte-for-byte matches the published v2 image (`ORIGINAL_RUNTIME_MATCH true`).

A temporary diagnostic build added ArduinoIO::write output/readback logging. The owner's exact GPIO program then produced pin=2/value=1/level=1 at 1836 ms, value=0/level=0 at 3836 ms, followed by alternating values at 5837/7837/9838/11838 ms (`gpio2-hardware-diagnostic.log`). Owner confirmed visible flashes, then clarified these are **brief flashes every two seconds**, not continuous two-second illumination. The dedicated LED opcode also prints to serial on each transition, unlike normal GPIO writes. Together these observations strongly implicate a USB/UART activity indicator rather than a visible LED connected to GPIO2; the indicator's actual wiring has not been identified from a schematic.

Additional control set GPIO2 continuously LOW (confirmed level=0), then sent only HELLO queries every 2 seconds for 40 seconds. Log: `gpio2-activity-control.log`. Owner was asked whether brief flashes continued; no answer to that final control was received before cleanup. Do not claim that visual control is confirmed.

Removed temporary diagnostic source changes and restored the original 325,920-byte runtime, verifying flash MD5. Restored the owner's **6484ebdf** algorithm and verified the matching boot marker after a separate reset (`gpio2-restored.json`, `gpio2-restore-console.log`). The board no longer contains diagnostic GPIO logging. Original program bytes are retained in `gpio2-user-program.bin`; pre-diagnostic partition backup is in `.cache/gpio-diagnostic/`.

Corrected misleading UI assumptions: block now says “світлодіод GPIO2”; tooltip/pinout/help explain that not every ESP32 board has an LED on this pin and that USB flashes do not indicate GPIO2 state. Installation completion describes the test signal rather than asserting a physical LED is blinking. Help names RST as well as EN. No GPIO interpreter defect was demonstrated, so the interpreter was not patched or special-cased. **61 unit/native/service tests and 2 pin-editor browser scenarios passed; static build passed.**

## 13.11.2026 — learner-defined commands («Мої блоки»)

Removed the ready-made motion palette and motion-based starter examples. Legacy block definitions/compiler opcodes remain readable for existing Wi-Fi project files. The active USB workshop now offers a custom command library with no parameters: create a definition on a separate full-screen canvas, call it repeatedly, nest commands, drill into them by double-click or the palette edit button, rename definitions globally, and delete unused definitions. A statement context-menu action extracts that statement and its following chain into a definition and replaces it with a call. Definition changes and extraction support grouped Undo; cancel/Escape leaves the project unchanged.

Definitions are stored by stable ID through Blockly's project serializer, alongside the existing blocks/variables in `.mcar` and local storage. Both compilers expand calls into existing instructions with bounded expansion, missing-definition errors, duplicate-name validation and direct/indirect recursion rejection. Errors inside a definition highlight the visible calling block. The current USB runtime needs no firmware update. Shared variables retain the existing global semantics. The separate legacy Wi-Fi runtime has not gained GPIO primitives.

Validation: **65 unit/native/service tests passed**, including nested GPIO commands executed by the actual C++ USB VM runner, source compiler parity, serialization, repeated-definition edits, malformed imports, recursion and expansion bounds. **24 browser scenarios checked**: 23 passed in the combined run; the remaining legacy mobile toolbar overflow was fixed with wrapping and its focused rerun passed. Scenarios include create/nest/rename/reload, double-click drill-down, atomic extraction/Undo, cancellation, recursion feedback, a working GPIO dropdown inside the mobile dialog, existing pin editor, USB flows, static nested-path hosting, initial setup and reconnection. Reviewed `my-blocks-editor.png` and `my-blocks-mobile.png`. Final `npm run build:site` passed. No physical ESP32 was flashed for this change and no remote deployment was performed.

Logs: `/tmp/mcar-my-blocks-tests.log`, `/tmp/mcar-my-blocks-browser.log`, `/tmp/mcar-my-blocks-build.log`. Local editor remains at http://127.0.0.1:5173/usb.html. Usage: `docs/classroom-web-usb.md`, section «Мої блоки».

## 13.11.2026 — graphical wiring and linked GPIO commands

Added a full-screen wiring editor to the USB workshop. It supports the owner's 38-pin ESP32, HW-627 DRV8833, yellow motor, nominal 4.8 V NiMH pack, computer USB and expansion board. Learners add/name/move components, click or drag terminals to connect them, edit wire colors/endpoints, undo/redo, inspect reusable 3D module models and compare the diagram with physical wires one at a time. Orthogonal wire paths avoid component interiors. Desktop/mobile screenshots were reviewed; mobile inspection scrolls independently without covering Apply.

A separate net model validates transitive connections, power/ground shorts, joined supplies, conflicting GPIOs, input-only/reserved pins, motor output misuse and wrong output pairs. Fatal errors prevent compilation. Incomplete circuits and unknown physical characteristics remain explicit: actual voltages/current, HW-627 jumpers, FAULT pull-up and expansion power are not verified by software. Expansion S/G routes only resolve after the learner explicitly identifies the host and confirms the layout. No USB-based detection of real wiring is claimed.

New connected-pin commands store stable driver-terminal references. Both source and bytecode compilers resolve GPIO from the applied diagram, including inside My Blocks. Rewiring previews affected definitions/commands; deleted links produce actionable compilation errors. Raw GPIO blocks keep their fixed pin numbers. Navigation works from commands to terminals and from terminals to commands/custom definitions. Diagram metadata and manual checklist state are serialized with `.mcar` and local storage. Existing runtime firmware is unchanged.

Validation: **73 unit/native/service tests passed**. The actual C++ VM executed a named PWM command from a custom block on GPIO23 after IN1 was rewired from GPIO16. **31 browser scenarios passed across the combined and focused runs**: 19 editor/regression scenarios, 10 static USB scenarios, one new static wiring/import/3D scenario, and one direct ESP32 3D mesh selection scenario. The last scenario exposed missing marker centering and differing mesh/diagram contact IDs; both were corrected and its rerun passed. Earlier dragging tests exposed a synthetic click after pointer release; this is now suppressed. Final static-site build passed. No physical board was flashed and no remote deployment was performed.

Artifacts: `wiring-desktop.png`, `wiring-mobile.png`, `wiring-3d.png`. Logs: `/tmp/mcar-wiring-tests.log`, `/tmp/mcar-wiring-browser.log`, `/tmp/mcar-wiring-final-browser.log`, `/tmp/mcar-wiring-static.log`, `/tmp/mcar-wiring-static-feature.log`, `/tmp/mcar-wiring-3d.log`, `/tmp/mcar-wiring-build.log`. Usage is documented in `docs/classroom-web-usb.md`, section «Графічні підключення».

## 13.11.2026 — physical terminals and mounted ESP32 expansion

Replaced the wiring editor's boxed thumbnail cards and side terminal columns with large top-view model renders. A shared physical layout supplies orthographic image bounds, on-board hit positions and wire endpoints, including the motor's cable ends and ESP32 micro-USB connector. Labels appear on hover/focus/selection. Models now use higher-resolution rendering, shadows, environment reflections and tone mapping; they remain photo-informed modeled components, not measured CAD or photographs.

Expansion is now an ESP32 property (`esp32s-38p`), absent from the component palette. The composite model places the ESP32 in the narrow sockets, with antenna facing left. Actual S/V/G header locations are selectable; S/G mapping remains conditional on the existing manual verification. Changing to a larger assembly moves neighboring modules out of its space. Removal with connected header wires is refused without deleting those wires. Existing single expansion/ESP32 diagrams migrate transactionally on editor opening, preserving endpoints and verification only when previously confirmed for that host. Unconnected internal reserved-pin mappings are excluded from external-connection errors; actual external reserved-pin wiring remains prohibited.

The left category palette supports drag-to-place with a preview. Dragging the module body moves it, background dragging/Space pans the canvas, Ctrl/Command-wheel zooms at the pointer, and floating fit/zoom/trash controls match the block workspace arrangement. Delete, Undo/Redo and drop-on-trash are supported. Wires use separated routing lanes and automatic role colors unless manually overridden. Coordinate consistency, saved-program GPIO resolution, safe detach, old-project migration, pan/zoom/drag and keyboard controls are covered by tests.

Validation: **74 unit/native/service tests passed; 22 editor/browser regression scenarios and 11 static browser scenarios passed (33 total)**. The mounted-assembly scenario was rerun after final lighting adjustment and passed. Desktop/mobile and assembled board screenshots were inspected. Static build passed. No hardware flashing or deployment performed. Logs: `/tmp/mcar-physical-all-unit.log`, `/tmp/mcar-physical-regression.log`, `/tmp/mcar-physical-static.log`, `/tmp/mcar-physical-art.log`, `/tmp/mcar-physical-build.log`. Preview: `wiring-mounted.png`.

## 13.11.2026 — restored expansion 5V header position

Owner identified a missing column on the expansion board. A minimal regression (`node --test --test-name-pattern 'photo layout' tests/wiring.test.mjs`) reproduced `bottom S: 16 !== 17`. The bottom-header filter incorrectly removed 5V along with GND and 3V3. Replaced derived header lists with explicit photo-transcribed 17-column lists, appending bottom-*-16 so existing endpoint IDs retain their meanings. Corrected the S/V/G physical order against the same photo: yellow S outside, black G inside, on both edges. Updated the older model test that had incorrectly enshrined a total of 33 S contacts.

The restored 5V contact is classified as a power rail, never a GPIO. Signal-route confirmation does not assert its internal power routing. The checker recognizes drawn external 5V supply without asking to add USB, keeps voltage/path verification explicit, checks the return ground, and blocks simultaneous USB/external 5V (including this new expansion terminal). A single external source feeding a 5V input is no longer mislabeled as two active sources; multiple actual supplies and different voltage rails remain errors.

Validation: new photo-layout/model/validator regression passed; all 9 wiring browser scenarios passed, including selecting 5V, drawing battery power, and observing compilation blocked by the USB power conflict. Reviewed `wiring-expansion-5v.png`. Full unit/native/service suite and static build results are in `/tmp/mcar-17pin-unit.log` and `/tmp/mcar-17pin-build.log`; browser log `/tmp/mcar-17pin-browser.log`. No physical wiring or firmware was changed.

## 13.11.2026 — canvas-first wiring layout

Collapsed the wiring title/undo/color/check tools into one compact header and moved short hints into the compact Apply/Cancel footer. Removed the permanent subtitle and redundant save explanation; actual rewiring impact still appears before Apply. The inspector is hidden with no selection and opens for components/pins/wires, explicit checks, or manual audit. Blank-canvas clicks and the inspector close button clear the selection. A persistent header toggle hides/restores the entire left palette with accessible expanded state; zoom and circuit data are preserved. Mobile layout gives the entire canvas width/height back when both panels are closed. Error/incomplete counts remain accessible in the compact check button.

Validation: **11 wiring browser scenarios passed**, including geometry checks (desktop canvas over 840 px tall in a 950 px viewport; collapsed mobile canvas over 385 px wide and 680 px tall at 390×844), palette reopening, inspector lifecycle, unchanged zoom and wire count, existing 3D/pin/rewiring/USB-conflict flows. Blank-canvas testing exposed delayed drag-state cleanup retaining the previous component after pointer-up; cleanup is now synchronous, and all drag/click regressions pass. Reviewed `wiring-workspace-expanded.png` and `wiring-workspace-mobile.png`. Static build passed. No hardware actions or deployment.

Logs: `/tmp/mcar-workspace-final-browser.log`, `/tmp/mcar-workspace-build.log`.

## 13.11.2026 — icon header, no footer

Moved the draft Apply/Cancel actions and contextual hint into the header and removed the footer. Header actions use consistent SVG icons with accessible names and hover titles. Apply is a green check; close discards the draft. Check counts remain badges. A compact changes indicator opens the affected-command GPIO list before applying; Escape closes that list first. Mobile uses one icon row plus a short hint row.

Validation: **12 wiring browser scenarios passed**, including Apply versus discard, impact popup/Escape, all header buttons within the 390 px mobile viewport, and existing wiring regressions. Reviewed refreshed desktop/mobile workspace screenshots; static site build passed. No hardware flashing or deployment. Logs: `/tmp/mcar-header-browser.log`, `/tmp/mcar-header-build.log`.

## 13.11.2026 — component quarter-turn rotation

Added contextual header icons for 90° left/right rotation when a component or pin is selected. Optional validated rotation metadata (0/90/180/270) preserves older projects. Physical layout rotates image bounds, pin positions and routing exit sides together, while keeping titles, labels and 3D model coordinates upright/unchanged. Artwork caching always renders the original orientation; CSS handles the quarter turn. Mounted ESP32/expansion rotates as one component. Rotation preserves endpoint IDs, electrical bindings and physical-check confirmations, supports undo/redo and persists through Apply/export/import.

Validation: **76 unit/native/service tests and 13 wiring browser scenarios passed**; static build passed. Covered every component's quarter-turn geometry, mounted board pins, unchanged generated GPIO code, malformed rotation rejection, save/load, undo/redo, both directions and mobile header bounds. Inspected `wiring-rotation.png`. An initial browser run was interrupted by Vite reloading during generated-asset build; the full rerun after build passed. Logs: `/tmp/mcar-rotation-all-unit.log`, `/tmp/mcar-rotation-browser.log`, `/tmp/mcar-rotation-build.log`. No hardware actions or deployment.

## 13.11.2026 — restored photographed auxiliary GND header

Re-inspected the owner's `assembly/references/esp32-38/expansion.png`: the black 2×4 header left of the barrel jack has top TX/RX/VCC/GND and bottom D22/D21/VCC/GND. A focused `node --test --test-name-pattern 'photo auxiliary' tests/wiring.test.mjs` failed with an empty pin list, establishing the omitted shared pin data as the cause; speculative hypotheses/instrumentation were unnecessary. Added eight stable auxiliary IDs, black male headers and silkscreen labels to the shared 3D and diagram layout. GND terminals participate in confirmed expansion ground routing; D21/D22 resolve to GPIO21/22; TX/RX remain reserved. VCC stays unknown without assuming a voltage or connection to another power rail. Long G-row tooltips now explicitly start with GND.

Validation: **77 unit/native/service tests and 14 wiring browser scenarios passed**. Repeated the auxiliary browser scenario after refining header placement clear of the mounting hole; inspected `wiring-aux-header.png`. Tests cover both grounds, VCC uncertainty, signal mapping, reserved UART contacts, ground-short detection and real click/wire/compile behavior. Static build passed. Logs: `/tmp/mcar-aux-unit.log`, `/tmp/mcar-aux-browser.log`, `/tmp/mcar-aux-visual.log`, `/tmp/mcar-aux-build.log`. No hardware actions or deployment.

## 13.11.2026 — actionable expansion power help and photographed jumper

Replaced the combined generic V/VCC/JUMP warning with a titled V-rail card explaining where JUMP is, which posts the owner's photo covers, changing it only without power, and asking the teacher to measure red V against black G before attaching a module. A separate VCC explanation is shown only when VCC has a drawn wire; it does not infer VCC voltage from JUMP. Unknown-rail wording now includes both V and VCC. Issue details remain visible and clicking the card focuses the corresponding contacts.

Rebuilt the decorative solid jumper as three vertical metal posts on a black base and an open yellow shunt over V–5V, matching the supplied photo. Added individual 3.3V / V / 5V labels and JUMP with tightly fitted label textures for readability. This depicts the photo, not live physical-board sensing or an editable simulated jumper.

Validation: **77 unit/native/service tests and 15 wiring browser scenarios passed**. Repeated the power-help browser scenario after label refinement; reviewed `wiring-jumper-help.png`. Static build passed. Logs: `/tmp/mcar-jumper-unit.log`, `/tmp/mcar-jumper-browser.log`, `/tmp/mcar-jumper-visual.log`, `/tmp/mcar-jumper-build.log`. No hardware actions or deployment.

## 13.11.2026 — clickable and configurable expansion jumper

Added a separate keyboard-accessible JUMP hit target using the same photo coordinates/projection as the model, including quarter turns. Selecting it opens a focused sidebar with an SVG bridge diagram, 3.3V/5V choices, S/V/G explanation and hardware-versus-diagram guidance. Component properties and the V-power issue link to the same panel. Choosing a voltage moves the actual model shunt, updates cached artwork and 3D viewer options, invalidates physical-check acknowledgements and participates in draft undo/redo/apply/cancel. Optional validated jumperVoltage metadata round-trips with projects; old projects display the clearly labeled 5V photo default. No measured power status, GPIO semantics or VCC routing is inferred from this selection. Delete while JUMP is selected does not delete its component.

Validation: **79 unit/native/service tests and 16 wiring browser scenarios passed**, covering shared model shunt movement, import validation, unchanged generated GPIO code, click/keyboard selection, updated image, rotation hit targets, undo/redo, save/reload and discarded edits. Reviewed `wiring-jumper-interactive.png`; static build passed. Logs: `/tmp/mcar-jumper-control-unit.log`, `/tmp/mcar-jumper-control-browser.log`, `/tmp/mcar-jumper-control-build.log`. No hardware actions or deployment.

## 13.11.2026 — crisp jumper at diagram zoom

The diagram previously enlarged a 2× raster model capture, including tiny textured labels and the shunt. Replaced that local detail with native SVG at the same photo coordinates: beveled yellow housing, dark recess, separate metal contacts and clear silkscreen labels. The raster thumbnail now omits the jumper to prevent duplicate blurred details; the full 3D viewer retains its physical jumper model. The vector layer follows component rotation and voltage, while its separate accessible hit target still opens the inspector. Removed the translucent selection fill and broad glow in favor of a thin outline. Base artwork no longer needs separate voltage cache entries.

Validation: **17 wiring browser scenarios and 5 module-model tests passed**. Verified 250% zoom with devicePixelRatio 2, both states, retained click/rotation/undo/save behavior. Reviewed `wiring-jumper-sharp-2x.png`; repeated the close-up scenario after moving the viewport clear of floating zoom controls for the screenshot. Static build passed. Logs: `/tmp/mcar-jumper-sharp-browser.log`, `/tmp/mcar-jumper-sharp-model.log`, `/tmp/mcar-jumper-sharp-visual.log`, `/tmp/mcar-jumper-sharp-build.log`.

## 13.11.2026 — keyboard component rotation

Added physical-key R for clockwise and Shift+R for counterclockwise quarter turns, including Ukrainian К layout. Works with component, pin or jumper selection; after rebuilding the component DOM, focus moves to the canvas so successive shortcuts keep working. Ignores typing/composition, key-repeat, active drags and Ctrl/Cmd/Alt combinations. Existing rotation buttons expose titles and aria-keyshortcuts. Rotation continues through normal undo/draft/apply behavior.

Validation: existing mounted-board rotation scenario passed; new focused keyboard scenario passed for repeated presses, both directions, Ukrainian code/key mapping, undo/redo, input editing, no selection, pin selection, modifiers, key-repeat and persistence. An initial assertion used Playwright's literal Shift+r (which types lowercase r); corrected it to the physical Shift+KeyR and reran successfully. Static build passed. Logs: `/tmp/mcar-rotate-keys-browser.log`, `/tmp/mcar-rotate-keys-build.log`.

## 13.11.2026 — short straight motor leads

Replaced the motor's decorative curved wire loops with two short parallel red/black leads at its rear and exposed metal tips. Shared contact coordinates keep diagram endpoints and all four motor detail models aligned. Routing leaves these contacts toward the left (and follows component rotation); tighter orthographic bounds remove the unused space beneath the old loops. Existing A/B endpoint identities and saved wiring remain unchanged.

Validation: **17 wiring/model unit tests and 18 wiring browser scenarios passed**; static build passed. Reviewed the refreshed `wiring-workspace-expanded.png`, including direct connections into both motor leads. Logs: `/tmp/mcar-motor-leads-unit.log`, `/tmp/mcar-motor-leads-browser.log`, `/tmp/mcar-motor-leads-build.log`.

## 13.11.2026 — LED, resistor and photographed 170-point mini breadboard

Added light-palette LED and resistor components with vector artwork and physical endpoint hit targets. LED properties select red/yellow/green; A/K polarity is depicted by lead length and a flat cathode edge. Resistors select E24 values from 10 Ω to 1 MΩ (default 330 Ω), rendering two significant-digit bands, multiplier and separated gold ±5% tolerance, with textual color names in the inspector. Coding follows the Vishay color-code reference linked in the classroom docs.

Added a white 170-hole mini breadboard matching the user's product/photo reference, archived at `assembly/references/breadboard-mini/front.png`. It has 17 numbered columns with A–E and F–J isolated five-hole groups, central groove, round mounting holes and no assumed power rails. All holes are selectable; selection highlights the five-hole bus. Internal buses participate in actual net analysis, and are transparent to existing motor/driver net checks. Number/letter labels are diagram aids.

Added simple active-high LED chain recognition through series resistors on either side and through breadboard buses. Valid LED circuits provide named GPIO write/PWM blocks and compile through the existing C++/bytecode path. A resistor is never unioned as a zero-ohm wire. Missing/bypassed resistance, reversed LED and input-only GPIO are reported; unsupported branched resistor networks remain unavailable. Low resistance is an explicit current-check advisory, not a blanket rejection of a potentially valid LED circuit. LED color does not imply exact forward voltage/current or simulate emitted light. New metadata is validated, serialized and supports rotation/undo/cancel; A/B resistor terminals are interchangeable.

Validation: **86 unit/native/service tests and 19 wiring browser scenarios passed**. New coverage decodes all supported resistor bands, checks metadata import/round-trip, direct and breadboard LED chains, resistor on either side, bad polarity/bypass/input-only, isolated breadboard groups, short detection, rotation bounds and C++/bytecode GPIO resolution. Browser scenario builds the entire circuit from the palette, changes all colors and resistor values, confirms 170 holes/5-hole highlighting, creates a PWM block, restores the project and rotates the breadboard. Repeated the LED browser case and full unit suite after refining the low-resistance advisory. Inspected `wiring-led-breadboard.png`; static build passed. No physical wiring, hardware flashing or deployment.

Logs: `/tmp/mcar-light-all-unit.log`, `/tmp/mcar-light-all-browser.log`, `/tmp/mcar-light-browser.log`, `/tmp/mcar-light-build.log`.

## 13.11.2026 — direct resistor and LED insertion into breadboard

Resized vector footprints to the board's hole pitch and aligned both LED lead tips. Dragging a resistor or LED near a compatible free pair previews two green insertion targets; releasing stores the two hole IDs and joins each leg electrically to its hole without adding visible wires. Installed component titles stay hidden until selection/hover. The inspector shows exact leg-to-hole placement and offers extraction; dragging away also detaches. Moving/rotating the breadboard carries inserted parts, while deleting the board leaves detached parts on the canvas. Rotation, undo/redo, cancel, serialization and GPIO binding use the same mounting metadata.

Import validation rejects missing boards, incompatible hole spacing, duplicate occupancy and wires in occupied holes. Existing direct leg-to-hole wires are converted on insertion; unrelated wiring remains intact. LED legs in a single conductive strip receive an explicit shorted-legs explanation. Updated the classroom lesson to use E5/F5 for the resistor and J5/J6 for the LED, with only GPIO, ground and USB wires. Component selection now restores canvas/header keyboard focus after inspector rebuilding.

Validation: **91 unit/native/service tests and 20 wiring browser scenarios passed**. New tests cover both C++ and bytecode compilation through inserted legs, all board rotations and edge movement, occupied holes, malformed imports, converting old leg wires, actual drag/drop previews, precise lead alignment, extraction by button and dragging, deletion, undo and project round-trip. Inspected `wiring-inserted-breadboard.png`. Static site build passed. No hardware flashing or deployment.

Logs: `/tmp/mcar-mount-all-unit.log`, `/tmp/mcar-mount-all-browser.log`, `/tmp/mcar-mount-build.log`.

## 13.11.2026 — free breadboard holes blocked by inserted LED artwork

Reproduced the reported GND connection failure with `cd web && npx playwright test tests/e2e/wiring.spec.js -g 'GND connects to a free' --repeat-each=2`: both runs failed with `Expected: 3` wires, `Received: 2`. A hit-test probe found the LED IMG at the free F6 hole; disabling that image's pointer events exposed the breadboard BUTTON and immediately allowed the third wire. The electrical occupancy validation was correct; the transparent image rectangle intercepted the click and selected the component instead.

Inserted artwork now ignores pointer events, with a separate transparent SVG grip restricted to the visible body for dragging. While a wire is pending, inserted bodies and headers yield pointer events and the artwork dims, exposing even holes behind a drawn body. Click wiring, drag wiring, rewiring and cancellation share the pending-wire state. Component extraction and rotation remain functional.

Validation: **91 unit/native/service tests and 22 wiring browser scenarios passed**; static site build passed. New browser regression coverage adds GND after insertion, starts a connection at a hole inside the image's transparent margin, drags a wire beneath the painted LED body on a rotated board, cancels wiring, reselects the body, and verifies persisted wire endpoints and mounting metadata. Previous coverage connected all wires before insertion, so it missed this interaction order; the new tests prevent recurrence. No debug instrumentation retained and no hardware flashing or deployment.

Logs: `/tmp/mcar-led-hole-red.log`, `/tmp/mcar-led-hole-focused.log`, `/tmp/mcar-led-hole-browser.log`, `/tmp/mcar-led-hole-unit.log`, `/tmp/mcar-led-hole-build.log`.

## 13.11.2026 — optional editor access without an ESP32

Added “Продовжити без плати” to idle connection, unsupported-browser, error and setup screens. It opens blocks, custom blocks, pinout and wiring tools without selecting a USB port. The choice survives reloads in the current tab via sessionStorage; project storage remains independent. The side panel explains editing without hardware, offers “Підключити ESP32”, and disables connection with a clear browser-support explanation where Web Serial is unavailable. Connecting later follows normal permission/readiness/setup steps without writing firmware; flashing remains a separate explicit action. Busy operations cannot be skipped, and flash/reinstall controls respect ongoing readiness checks.

Validation: **19 browser scenarios passed** across browser USB, local USB and the new optional-access suite. Coverage includes editing and saving wiring without USB, download, reload, unsupported browsers, cancelled late selection, project preservation when connecting later, actual algorithm transfer through the mocked serial protocol, existing setup/reconnect behavior and static deployment under a nested path without local APIs. Static site build passed; visually inspected `usb-optional-connection.png`. No hardware flashing or deployment.

Logs: `/tmp/mcar-offline-browser.log`, `/tmp/mcar-offline-all-browser.log`, `/tmp/mcar-offline-build.log`.

## 2026-11-13 — Automatic and manual wire routing

Integrated libavoid-js 0.4.5 (WASM) in a dedicated Web Worker. Orthogonal routes avoid solid components; breadboards remain wiring surfaces. Fixed physical pin anchors, rounded corners, draggable segments/checkpoints, grid/Alt, keyboard controls, per-wire/global reset, Undo/Redo, import/export. Native heading clearance checked across all four component orientations. Slow or unavailable workers fall back without blocking editing; one pending latest scene avoids stale route application.

Validation of the final implementation:

- `npm test`: **97 passed** (including real WASM routing, pin exit directions, metadata validation and unchanged electrical bindings).
- `npx playwright test tests/e2e/wiring.spec.js tests/e2e/wiring-routing.spec.js`: **26 passed** in Chrome. Covers insertion, rotations, rewiring, manual drags, keyboard editing, cancellation, persistence, worker failure/deadline and reopening.
- `npm run build:site`: passed; separate worker/WASM, LGPL notice and corresponding source archives included.
- `npx playwright test tests/e2e/browser-usb.spec.js`: **13 passed**, including worker/WASM loading from `/mcar/`, offline editing and existing browser USB workflows with mocked serial hardware.
- Visually inspected `wiring-automatic-routing.png` and `wiring-manual-routing.png`.

No physical firmware flashing or deployment performed. Dense diagrams may reach the 2.5-second worker deadline and use simpler routing. Impossible/overlapping layouts are not guaranteed obstacle-free. See `docs/wiring-routing.md` for approach, controls, sources and licensing.

## 2026-11-13 — DRV8833 direct breadboard placement

Generalized two-leg mounting to rigid multi-pin footprints. HW-627 has 12 pins with owner-specified seven-pitch row spacing; the 3D contact positions and wiring hit targets share that geometry. Diagram scale matches breadboard pitch even before insertion. All twelve holes must exist and be free. Hole membership provides electrical connectivity without generated wires; malformed, mirrored, partial and occupied imported footprints are rejected. Mounted driver supports body selection, moving/rotating with the board, individual rotation/detach, Undo/Redo and project persistence.

Validation: 100 unit tests passed; 27 Chrome wiring/routing/mounting scenarios passed; `npm run build:site` passed; 2 built-site import/module-viewer/worker smoke scenarios passed. Visually inspected `driver-breadboard.png`. No hardware flashing or deployment. Only pin-row spacing is owner-confirmed; PCB outline remains a visual estimate from the supplied photographs.

## 2026-11-13 — Unlabelled component canvas

Removed component headings and their reserved 36-pixel strip from the wiring canvas, including inserted components. Removed invisible heading obstacles from routing. Component names remain in the palette, inspector and accessible labels; body selection/dragging and keyboard focus replace title-bar interactions. Existing browser scenarios now interact with component bodies (free plastic on an occupied breadboard). 100 unit tests and all 27 wiring browser scenarios passed; site build passed. Visually inspected the updated driver/breadboard screenshot.

## 2026-11-13 — Explain missing connected-pin commands

Reconstructed the relevant screenshot path: ESP32 expansion S GPIO34/35 → mini breadboard A1/A2 → inserted HW-627 IN4/IN3. The second driver, motor and supplies are unnecessary to reproduce the missing commands. Native Chrome could be viewed but its export interaction returned `noWindowsAvailable`; the reproduction uses the screenshot-derived fixture rather than claiming access to the user's project data.

Red-capable loop: `cd web && npx playwright test tests/e2e/wiring-unavailable.spec.js`. Before fix, expected `GPIO34` in the toolbox; actual text was the generic “Підключи світлодіод із резистором або IN драйвера до GPIO”. Differential analysis confirmed: unverified expansion yields unavailable bindings; setting only verification reveals input-only errors; changing only signal sources to GPIO16/17 makes the bindings available. Breadboard connectivity itself was intact.

Root cause of the misleading UI: the toolbox discarded unavailable bindings before deciding whether anything was connected. Added shared diagnostics for the palette and pin inspector, compact wrapped explanations, links to expansion verification and specific contacts. Candidate GPIO numbers are explanatory only; compilation still rejects unverified/invalid outputs. No physical wiring or user confirmation is auto-modified. Avoiding this class of failure requires preserving rejected connections plus reasons in the presentation layer instead of conflating “none connected” with “none usable”.

Validation: 102 unit tests passed; 23 existing wiring/driver browser scenarios and 3 My Blocks scenarios passed. New screenshot-derived browser scenario passes through verification, input-only explanation, contact navigation and four usable command blocks after GPIO correction. Built-site import/viewer and new diagnostic navigation tests both passed; site build passed. Updated an old static test's removed component-header selector to body selection. Inspected `wiring-unavailable-pins.png`; no debug instrumentation remains. No firmware flashing or deployment.

## Expansion pin documentation — 2026-11-13

Added a selected-contact documentation card above schematic diagnostics for all 110 physical expansion contacts (two 17×3 S/V/G headers and the auxiliary 2×4 header). Signal contacts reuse ESP32 descriptions and capability lists, including SP/SN aliases, input-only pins, boot restrictions, UART and flash reservations. V/G documentation does not inherit the GPIO of its column. V follows the diagram's JUMP choice; auxiliary VCC remains explicitly unverified. Links navigate to the actual ESP32 contact, physical mapping verification, or the existing jumper inspector without changing the circuit or confirming hardware.

Browser verification exposed native Escape cancellation after repeated contact navigation. Pending wires now intercept Escape at keydown, preserving the documentation panel instead of dismissing the constructor. Existing native cancel handling remains for other dismissal paths.

Validation: 105 unit tests passed; 24 browser scenarios passed, including direct physical pin clicks, input/output modes, GND/VCC, auxiliary GPIO21, ESP32 contact navigation, V→JUMP and unchanged empty wiring after browsing. Updated the prior 5V assertion to match the shared ESP32 documentation. Final static site build passed. Visually inspected `expansion-pin-documentation.png`: compact capability badges and sidebar text fit without overlaps. No hardware flashing or deployment.

## Actionable wiring checks and S/G navigation — 2026-11-13

Reproduced the user’s two missing motor-input connections with GPIO25/26 routed to IN4/IN3 while the motor uses OUT1/OUT2. Before the UI change, `npx playwright test tests/e2e/wiring-checks.spec.js` failed because no explicit incomplete-connections region existed beneath the count (expected two motor-control entries, found zero). The old S/G issue also had no terminal keys, so its generic pin-navigation handler could not reach the checkbox.

Error/incomplete cards now appear directly below the status with specific pin targets and mounted breadboard hole addresses. Other manual checks remain below. Each unverified expansion has an explicit component navigation button; the target panel scrolls/focuses the real checkbox, explains physical verification, and brings that ESP32 into the canvas viewport. Navigation cancels pending wiring without adding wires or asserting verification. Reused the same destination from pin documentation and unavailable-binding diagnostics.

Validation: 25 browser scenarios passed, including the new user-scenario regression (two entries IN1/C6 and IN2/C5; pin highlighting; checkbox focus/visibility; unchanged wires; GPIO25/26 commands after explicit checking). Re-ran that scenario after adding viewport navigation: passed. Final static site build passed. Inspected `wiring-actionable-checks.png` and `wiring-sg-verification.png`. Prevent recurrence by giving status counts concrete adjacent actions and binding component-level checks to components rather than empty pin targets.

## Drag wire endpoints between pins — 2026-11-13

Added direct endpoint relocation from singly wired pins (including an already selected/pending origin), explicit endpoint handles on selected wires, and a prompt to choose a wire when the pin has multiple connections. Shift-drag retains new-wire creation. Preview does not change the graph: commit updates only the selected endpoint after a valid drop, retaining wire ID, color, stored endpoint orientation and checkpoints. Existing click-based replacement now retains orientation/checkpoints too. The graph is revalidated, audit marks reset on physical change, and Undo/Redo works through the existing transaction path. Escape, invalid/self/duplicate drops and blank-canvas drops retain the original connection. Keyboard Enter/Space on an endpoint uses the existing choose-pin replacement flow.

Validation: five new browser scenarios cover the user's selected OUT2 → OUT4 case on a breadboard-mounted DRV8833, both stored endpoint directions, metadata persistence/reload, Undo/Redo, Escape, same-pin/blank/self drops, shared-pin disambiguation, keyboard replacement, Shift creation and duplicate rejection with unchanged audit state. Final run: all 31 endpoint, wiring and route-editing scenarios passed. Three related pin-documentation/diagnostics/checks scenarios passed in the preceding regression run. The occupied-hole draft test was corrected: dropping over an inserted driver's pin selects that physical driver pin, not the breadboard hole beneath it. Duplicate rejection is asserted during drag and through unchanged saved state rather than transient hover copy after release. Static site build passed; inspected `wiring-endpoint-drag.png`. No physical hardware changes or flashing.
## Remove S/G confirmation gate — 2026-11-13

Removed the expansion S/G checkbox, related help/navigation and availability gate. The supported ESP32S 38P profile now supplies its defined signal and ground mapping immediately. Deprecated `signalsVerified` booleans remain accepted on import but do not affect connectivity, so existing projects work without migration or confirmation. Legacy separate expansion components still require their host ESP32. GPIO capability restrictions and independent V/VCC/JUMP checks remain unchanged.

Validation: 106 unit tests passed, including equivalent mappings/compiler output for absent, false and true legacy flags. Thirty browser scenarios passed, covering expansion documentation, actionable incomplete connections, unavailable input-only GPIOs, mounted wiring and endpoint dragging. Static site build and published-site diagnostic scenario passed. No hardware flashing or deployment.


## Group block selection and independent command copies — 2026-11-13

Added shared selection controls to the USB workspace and My Blocks definition editor: Shift-click, additive marquee, pointer selection mode, selection count/highlights, copy/cut/paste/duplicate/delete, group context menus and Ctrl/Cmd shortcuts. Actions use Blockly serialization and grouped undo events. Selection includes input expressions/bodies but excludes unselected following commands; cut/delete heal surrounding stacks. The session clipboard works across the two editors, retains variable metadata, and rejects unresolved draft-definition references. Protected definition hats remain intact. Text/field controls retain their native shortcuts; modal selection listeners are disposed on close. Selected commands use a consistent blue outline, including the native selected block.

My Blocks now offers independent definition copies from its palette, definition editor and call context menu. Copies get unique IDs/names and cloned bodies with fresh block IDs; nested command references and shared variables are retained. Cancel leaves the saved library unchanged; saving/Undo/Redo and project reload retain independence.

Implementation uses the installed Blockly 13 serialization/events APIs. Evaluated the MIT workspace-multiselect package, but its published peer dependency requires Blockly >=11 <12 and its stack-copy behavior includes unselected tails. No incompatible dependency was added. References: https://docs.blockly.com/guides/configure/copy-paste/ and https://github.com/mit-cml/workspace-multiselect .

Validation: 111 unit tests passed, including exact/disjoint selections, selection order, protected hats, stack healing, variable metadata and independent definition copies. Seven Chrome development scenarios passed for mouse/keyboard actions, marquee/mode, cross-editor paste, context actions, Undo/Redo, save/reload, nested definitions and mobile layout. Static site build and an additional built-site grouping/definition-copy scenario passed without local APIs. Visually inspected block-multiselect.png, my-block-multiselect.png and the updated mobile editor screenshot. No hardware flashing or deployment.

## Accordion palette and contextual controls — 2026-11-13

Replaced the overlay toolbox in both USB and My Blocks editors with a scoped Blockly Toolbox/VerticalFlyout adapter. The native flyout SVG lives beneath the selected category in the left column; one category is open at a time, previews fit the column, and the sidebar scrolls independently. Native block serialization, variables, dynamic wired-pin entries and drag-to-workspace behavior are preserved. The adapter disconnects its ResizeObserver on disposal and resizes command action rows with the column.

Removed repeated edit/copy flyout button rows. Each custom-command preview now exposes small edit/duplicate icons on hover or keyboard focus; touch devices show them without requiring hover. A transparent hit area bridges the block and its action row. Kept the existing definition editor and context-menu actions. Moved group controls to a compact canvas overlay: only selection mode is shown initially, with actions appearing for a selection and paste appearing when the session clipboard has content.

Validation: 12 development browser scenarios passed (11 regression cases plus the corrected long-list scenario). Coverage includes accordion placement/collapse, hover/focus/touch actions, duplicate/edit flows, native dragging before and after sidebar scroll, variables, viewport resize, group selection/Undo, nested definitions and wired-pin diagnostics. The long-list test was corrected to match Blockly's nonbreaking space in SVG text. Static build and two built-site browser scenarios passed. Visually inspected accordion-my-blocks.png and accordion-mobile.png. No firmware or electrical-model changes and no deployment.

## Parameterized My Blocks — 2026-11-13

Custom definitions now carry up to six stable-ID parameters: Number, Boolean and GPIO, with names and defaults. The definition editor has a collapsible parameter section and a scoped reporter category. Numeric/Boolean reporters plug into expressions/conditions; GPIO parameters appear in the existing pin dropdowns and can be passed to nested calls. Call blocks render typed argument sockets with editable defaults. Existing parameterless projects stay compatible. Renames preserve arguments; independent definition copies remap their own parameter references. Removal/type changes are blocked while referenced or called. Group clipboard rejects parameters outside their owning definition.

Compilation lowers calls into existing GPIO and variable instructions without changing the board runtime. Number/Boolean expressions are evaluated once per call into local frame slots, reused by sequential calls and separated across nesting; the existing eight-variable limit includes active parameter slots. GPIO arguments resolve at compile time and retain action-specific capability checks. Scope, kind, default, recursion and import checks reject invalid definitions before GPIO dropdown coercion. Newly added arguments on existing nested calls receive defaults. Definitions, arguments and IDs survive save/reload, duplication and library Undo/Redo.

Validation: the complete 118-test unit suite passed; a subsequently added nested argument-kind regression also passed in the 13-test focused suite. Native C++ VM tests cover repeated calls with distinct GPIO/duty values, by-value capture, nested frame isolation, Boolean branches, defaults, GPIO34 output rejection and definition duplication. Fifteen related development browser scenarios passed (14 in the combined run, with the mobile test corrected to scope its option locator and then passing). These exercise native reporter dragging, GPIO parameter selection, parameter creation, distinct call values, save/reload, duplicate definitions, Undo/Redo, accordion/selection regression and mobile menus/removal guards. Two built-site Chrome scenarios passed, including parameterized project import, local compilation and upload flow using simulated serial/flash transport under a nested Pages URL. Static site build succeeded, including the final kind-check change. Inspected parameterized-block-editor.png, parameterized-block-calls.png and parameterized-block-mobile.png. No physical flashing or deployment.


## One USB workshop and in-place assembly guide — 2026-11-13

Made index.html the canonical USB workshop in both Vite development and static builds. usb.html and robot.html are compatibility redirects retaining query strings and guide hashes under root and nested Pages paths. The assembly guide is lazy-loaded inside the workshop; returning via “До блоків”, Escape, final step or browser navigation preserves the exact workspace and selected USB port without reloading. A direct guide URL requires no board and returns to the editable USB workspace. USB storage keys remain unchanged; legacy Wi-Fi storage is not erased.

Removed the legacy web entry, Wi-Fi compiler/examples and robot-specific block definitions, retaining robot_wait for serialized USB compatibility. Shared compile errors now have their own module. Removed guide dependencies on Wi-Fi polling/STOP, scoped guide styles to avoid changing the USB header, and replaced the page-swapping/firmware-header build script with static site packaging. Historical firmware assets remain separate; its build helper no longer suggests the USB site can regenerate them. Updated navigation, classroom and build documentation.

Validation: 107 unit tests passed. Both build and build:site succeeded. Final 32 browser scenarios passed across workshop navigation, assembly, component details and the built static USB application. Coverage includes exact project/connection retention, browser history, old bookmark redirects, nested /mcar/ paths, parameterized command compilation and mocked USB writes. Five fullscreen fallback/scroll-lock tests passed; two native fullscreen tests did not pass in this headless Chrome environment: requestFullscreen rejects with TypeError “not granted” on both the guide and unchanged chassis viewer, and the application correctly uses its viewport fallback. Native fullscreen is therefore not verified here. Inspected usb-guide-root.png. No physical flashing or deployment.


## Contextual fixed wire colors — 2026-11-13

Removed the native color picker and custom-color state from the wiring header. A selected wire now exposes eight labeled color buttons in its inspector: red for power, black for ground, and yellow/green/blue/purple/orange/white for signals. New wires automatically use palette colors based on endpoint roles; existing saved colors are preserved until explicitly changed. Selection is indicated with aria-pressed and a border, keyboard focus survives inspector rerenders, and recoloring remains a nonphysical undoable change.

Validation: 27 existing wiring/endpoint browser scenarios passed. An isolated browser interaction verified no native wire color inputs, eight choices, immediate selection, Undo/Redo and persistence after Apply/reload. Inspected wire-fixed-palette.png and shortened the orange label to avoid awkward wrapping. Static site build passed. No physical USB operations or deployment.


## Remove unconditional HW-627 J1 advisory — 2026-11-13

Removed the unconditional sleep/J1/current-limit advisory from wiring analysis, so adding a DRV8833 no longer creates that manual-check item. Concrete power, common-ground and motor-pair diagnostics remain unchanged. In optional component documentation, replaced the unsupported assertion that J1 determines the mode with an explicit statement that its connection to SLEEP is unconfirmed for this module. No hardware setting is inferred or changed.

Validation: wiring and component unit suites passed; static site build passed. Existing circuit test now checks absence of the removed advisory while retaining other checks. No physical board operations.


## Separate pin inspection from wiring — 2026-11-13

Clicking a pin (including keyboard activation and selection from the 3D viewer) now selects documentation only. New wires require dragging between pins or the explicit “Під’єднати провід” inspector action followed by a destination click. The component pin selector uses that same explicit action. Connected pins also start new wires; existing-wire relocation is restricted to selected endpoint handles or the existing replacement action. New-wire targets show valid/invalid drop feedback. Escape, cancellation buttons, blank and duplicate drops leave no pending wire; successful creation is one-shot. Escape on an inspected pin clears selection, while the impact popover retains its own dismissal priority.

Updated classroom/routing documentation and interaction tests to reflect the new gestures. Final 32 browser scenarios passed, including three new regressions for inspection without graph/history changes, explicit keyboard creation and cancellation, and dragging from connected pins without changing existing wires. Endpoint relocation, Undo/Redo, expansion documentation, mounted DRV8833, LED and resistor connections all passed. Static site build passed. Inspected wiring-pin-inspect.png. No physical board operations or deployment.
