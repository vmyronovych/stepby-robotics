# Відтворення матеріалів

Із кореня проєкту створіть власне Python venv і встановіть `tools/requirements.txt`. Для кошторису потрібен Node та `@oai/artifact-tool` з середовища, яке підтримує цей пакет; `tools/node_modules` у початковому робочому середовищі є локальним посиланням, його не включено в архів. Готові CSV/Markdown не потребують цих залежностей для читання.

```sh
python3 tools/build_lessons.py
python3 tools/build_wiring.py
python3 assembly/sources/build_manual.py
node tools/build_bom.mjs
python3 tools/check_project.py
node tools/check_web_ui.mjs
```

Тести C++ та цільова збірка: `firmware/README.md`. Відсутність Arduino CLI не компенсується host-заглушками. Шлях шрифтів і розділення виміряних/демонстраційних даних: `assembly/sources/README.md`.

Відомість компонентів `build_bom.mjs` використовує workbook і формули для сум; готові значення експортує в CSV. Після зміни цін повторити перевірку арифметики. Ціни не оновлюються автоматично з магазинів.

Послідовні ілюстрації генеруються обчислювально; жодне зображення складання не створено генеративною моделлю. Для прев’ю PDF використано `pdftoppm -r 85 -png assembly/assembly-manual.pdf validation/pdf-preview/page`. Перегляд усіх сторінок після правок обов’язковий.

Майстерня v0.2: `npm ci --prefix web`, `npm run build --prefix web`, `sh tools/build_firmware.sh`. Після тестів `python3 tools/package_workshop.py` створює USB/OTA образи, manifest/SHA256 та архів. `build_lessons.py` зберігає підказки Blockly з `lessons/workshop-notes.json`; сім `.txt` лишаються legacy форматом `/control`. Браузерні й VM тести: `web/README.md` та `validation/report.md`.

3D-гайд v0.3: `python3 tools/export_assembly.py` експортує спільну з PDF модель і копіює схему в браузерні ресурси. Цей експорт автоматично входить до `npm run build --prefix web`. Three.js також локально входить у firmware; окремий CDN не потрібен.
