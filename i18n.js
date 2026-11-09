// Czech is the default. Source aliases also cover labels in older saved menu sets.
(() => {
    const rows = [
        ['Sběrnice {0}', 'Bus {0}'], ['+ Přidat', '+ Add'],
        ['Скрыть зоны PIR', 'Skrýt zóny PIR', 'Hide PIR coverage'], ['Показать зоны PIR', 'Zobrazit zóny PIR', 'Show PIR coverage'],
        ['Выключить сетку', 'Vypnout mřížku', 'Hide grid'], ['Включить сетку', 'Zapnout mřížku', 'Show grid'],
        ['Укажите порог яркости от 0 до 255 и радиус PIR от 10 до 2000 пикселей.', 'Zadejte práh jasu 0–255 a dosah PIR 10–2000 pixelů.', 'Enter a brightness threshold of 0–255 and a PIR range of 10–2000 pixels.'],
        ['Некорректные настройки', 'Neplatné nastavení', 'Invalid settings'], ['Не удалось распознать стены: {0}', 'Stěny se nepodařilo rozpoznat: {0}', 'Could not detect walls: {0}'],
        ['Ошибка распознавания стен', 'Chyba rozpoznání stěn', 'Wall detection error'], ['Nový projekt', 'New project'],
        ['Opravdu chcete začít nový projekt? Neuložené změny budou ztraceny.', 'Start a new project? Unsaved changes will be lost.'],
        ['Žádná data k tisku.', 'There is nothing to print.'], ['Печать', 'Tisk', 'Print'], ['Чертёж: {0}', 'Výkres: {0}', 'Drawing: {0}'],
        ['Не удалось подготовить чертёж к печати.', 'Výkres se nepodařilo připravit k tisku.', 'Could not prepare the drawing for printing.'],
        ['Ошибка печати', 'Chyba tisku', 'Printing error'], ['Не удалось подготовить чертёж к печати: {0}', 'Výkres se nepodařilo připravit k tisku: {0}', 'Could not prepare the drawing for printing: {0}'],
        ['Poznámka', 'Note'], ['Bezdrátový PIR', 'Wireless PIR'], ['Magnetický kontakt', 'Magnetic contact'], ['Bezdrátový Magnet', 'Wireless magnetic contact'],
        ['Tříštění skla', 'Glass break'], ['Tísňové tlačítko', 'Panic button'], ['Siréna', 'Siren'], ['Ústředna EZS', 'Alarm control panel'],
        ['Expandér (EXP)', 'Expander (EXP)'], ['Klávesnice', 'Keypad'], ['Deaktivováno', 'Disabled'], ['Textová poznámka', 'Text note'],
        ['Tajný Ramen', 'Secret ramen'], ['Nástroj kabelu', 'Cable tool'], [' (Ručně)', ' (Manual)'], ['Sběrnice: {0}', 'Bus: {0}'],
        ['Ошибка открытия проекта', 'Chyba otevření projektu', 'Project opening error'],
        ['Локальное сохранение недоступно. Создайте или откройте другой проект.', 'Místní záloha není dostupná. Vytvořte nebo otevřete jiný projekt.', 'The local save is unavailable. Create or open another project.'],
        ['Не удалось продолжить проект', 'Projekt nelze obnovit', 'Could not resume the project'],
        ['Изображение загружено, но стены распознать не удалось: {0}', 'Obrázek je načten, ale stěny se nepodařilo rozpoznat: {0}', 'The image loaded, but wall detection failed: {0}'],
        ['План загружен с предупреждением', 'Výkres načten s upozorněním', 'Drawing loaded with a warning'], ['Chyba při načítání PDF.', 'Could not load the PDF.'],
        ['Ошибка загрузки PDF', 'Chyba načítání PDF', 'PDF loading error'], ['Chyba při zpracování DXF souboru.', 'Could not process the DXF file.'],
        ['Ошибка загрузки DXF', 'Chyba načítání DXF', 'DXF loading error'], ['Soubor je prázdný.', 'The file is empty.'], ['Neznámá struktura dat v souboru.', 'Unknown file data structure.'],
        ['Obnovený projekt', 'Recovered project'], ['Chyba při načítání souboru .TECH!\n\nDetail chyby: ', 'Could not load the .TECH file.\n\nError details: '],
        ['Не удалось прочитать файл проекта.', 'Soubor projektu nelze přečíst.', 'Could not read the project file.'], ['Bez názvu', 'Untitled'],
        ['Проверяем вход…', 'Ověřování přihlášení…', 'Checking sign-in…'], ['Вы вошли как {0}', 'Přihlášený uživatel: {0}', 'Signed in as {0}'], ['Google-пользователь', 'Uživatel', 'User'],
        ['Проверка входа заняла слишком много времени. Проверьте интернет и попробуйте снова.', 'Ověření přihlášení trvá příliš dlouho. Zkontrolujte připojení a zkuste to znovu.', 'Sign-in verification timed out. Check your connection and try again.'],
        ['Проверяем сохранённую сессию…', 'Ověřování uloženého přihlášení…', 'Checking the saved session…'],
        ['Сессия истекла. Войдите в аккаунт снова.', 'Platnost přihlášení vypršela. Přihlaste se znovu.', 'Your session expired. Sign in again.'],
        ['Не удалось проверить вход. Проверьте подключение и войдите снова.', 'Přihlášení nelze ověřit. Zkontrolujte připojení a přihlaste se znovu.', 'Could not verify sign-in. Check your connection and sign in again.'],
        ['Не удалось загрузить сервис входа. Проверьте подключение и попробуйте снова.', 'Přihlašovací službu nelze načíst. Zkontrolujte připojení a zkuste to znovu.', 'Could not load the sign-in service. Check your connection and try again.'],
        ['Сначала заполните веб-конфигурацию Firebase в config.js.', 'Doplňte konfiguraci Firebase v souboru config.js.', 'Complete the Firebase configuration in config.js.'],
        ['Вход выполняется...', 'Přihlašování…', 'Signing in…'],
        ['Google-вход доступен только на сайте с HTTPS или localhost. Откройте GOOM по адресу https://pzts.five.surf/.', 'Přihlášení je dostupné pouze přes HTTPS nebo localhost. Otevřete https://pzts.five.surf/.', 'Sign-in requires HTTPS or localhost. Open https://pzts.five.surf/.'],
        ['Добавьте домен сайта в список разрешённых доменов Firebase Authentication.', 'Přidejte doménu webu mezi povolené domény Firebase Authentication.', 'Add the website domain to Firebase Authentication authorized domains.'],
        ['Включите провайдер Google в настройках Firebase Authentication.', 'Povolte poskytovatele Google ve Firebase Authentication.', 'Enable the Google provider in Firebase Authentication.'],
        ['Не удалось войти через Google', 'Přihlášení přes Google se nezdařilo', 'Google sign-in failed'], ['Подключаем сервис входа…', 'Připojování přihlašovací služby…', 'Connecting to the sign-in service…'],
        ['Не удалось выйти из аккаунта', 'Odhlášení se nezdařilo', 'Sign-out failed'], ['Модуль Firebase не загружен.', 'Modul Firebase není načten.', 'The Firebase module is not loaded.'],
        ['Войдите через Google для синхронизации', 'Přihlaste se pro synchronizaci', 'Sign in to sync'], ['Сначала войдите через Google.', 'Nejprve se přihlaste.', 'Sign in first.'],
        ['Облачные проекты', 'Cloudové projekty', 'Cloud projects'], ['Дождитесь загрузки проекта и повторите попытку.', 'Počkejte na načtení projektu a zkuste to znovu.', 'Wait for the project to load and try again.'],
        ['Введите название для сохранения в облаке:', 'Zadejte název projektu pro uložení do cloudu:', 'Enter a project name to save to the cloud:'], ['Сохранить проект', 'Uložit projekt', 'Save project'],
        ['Синхронизация…', 'Synchronizace…', 'Syncing…'], ['Без названия', 'Bez názvu', 'Untitled'],
        ['Не удалось создать копию конфликта. Повторите сохранение.', 'Konfliktní kopii nelze vytvořit. Zkuste uložit projekt znovu.', 'Could not create a conflict copy. Try saving again.'],
        ['{0} (копия)', '{0} (kopie)', '{0} (copy)'], ['Проект сохранён, но старая версия не удалена', 'Projekt je uložen, ale starou verzi nelze odstranit', 'Project saved; the previous version could not be removed'],
        ['Изменения разошлись: сохранена отдельная копия', 'Změny jsou v konfliktu: byla uložena samostatná kopie', 'Conflicting changes: a separate copy was saved'],
        ['Облако: сохранено', 'Uloženo v cloudu', 'Saved to cloud'], ['Ошибка облака: {0}', 'Chyba cloudu: {0}', 'Cloud error: {0}'],
        ['Не удалось сохранить проект в облако', 'Projekt nelze uložit do cloudu', 'Could not save the project to the cloud'],
        ['Не удалось очистить незавершённую загрузку', 'Nedokončené nahrávání nelze odstranit', 'Could not remove the incomplete upload'],
        ['Загружаю список проектов…', 'Načítání seznamu projektů…', 'Loading projects…'], ['В облаке пока нет проектов.', 'V cloudu zatím nejsou žádné projekty.', 'There are no cloud projects yet.'],
        ['Изменён: {0}', 'Změněno: {0}', 'Updated: {0}'], ['Дата изменения неизвестна', 'Datum změny není dostupné', 'Update date unavailable'],
        ['Открыть', 'Otevřít', 'Open'], ['Удалить', 'Odstranit', 'Delete'], ['Проектов в облаке: {0}', 'Projektů v cloudu: {0}', 'Cloud projects: {0}'],
        ['Ошибка списка: {0}', 'Chyba seznamu: {0}', 'Project list error: {0}'], ['Открыть «{0}»? Текущий проект будет заменён.', 'Otevřít „{0}“? Aktuální projekt bude nahrazen.', 'Open “{0}”? The current project will be replaced.'],
        ['Открыть облачный проект', 'Otevřít cloudový projekt', 'Open cloud project'], ['Загружаю проект…', 'Načítání projektu…', 'Loading project…'],
        ['Не удалось загрузить файл проекта из Firebase Storage.', 'Soubor projektu nelze stáhnout z Firebase Storage.', 'Could not download the project from Firebase Storage.'],
        ['Не удалось открыть данные проекта', 'Data projektu nelze otevřít', 'Could not open the project data'], ['Облачный проект открыт', 'Cloudový projekt je otevřen', 'Cloud project opened'],
        ['Ошибка открытия: {0}', 'Chyba otevření: {0}', 'Opening error: {0}'], ['Не удалось открыть облачный проект', 'Cloudový projekt nelze otevřít', 'Could not open the cloud project'],
        ['Удалить «{0}» из облака?', 'Odstranit „{0}“ z cloudu?', 'Delete “{0}” from the cloud?'], ['Удалить проект', 'Odstranit projekt', 'Delete project'],
        ['Ошибка удаления: {0}', 'Chyba odstranění: {0}', 'Deletion error: {0}'], ['Не удалось удалить облачный проект', 'Cloudový projekt nelze odstranit', 'Could not delete the cloud project'],
        ['Войдите через Google, чтобы открыть облачные проекты.', 'Pro otevření cloudových projektů se přihlaste.', 'Sign in to open cloud projects.'],
        ['Аккаунт: {0}', 'Účet: {0}', 'Account: {0}'], ['подключён', 'připojeno', 'connected'], ['Firebase недоступен: {0}', 'Firebase není dostupný: {0}', 'Firebase unavailable: {0}'],
        ['Настройте Firebase для синхронизации', 'Nastavte Firebase pro synchronizaci', 'Configure Firebase to sync'],
        ['Понятно', 'Rozumím', 'OK'], ['Сохранить', 'Uložit', 'Save'], ['Подтвердить', 'Potvrdit', 'Confirm'], ['Сообщение', 'Zpráva', 'Message'],
        ['Подтвердите действие', 'Potvrďte akci', 'Confirm action'], ['Введите значение', 'Zadejte hodnotu', 'Enter a value'],
        ['Ошибка локального сохранения', 'Chyba místního ukládání', 'Local save error'], ['Не удалось прочитать локальное сохранение.', 'Místní zálohu nelze přečíst.', 'Could not read the local save.'],
        ['Žádná data k exportu.', 'There is nothing to export.'], ['Экспорт проекта', 'Export projektu', 'Export project'], ['Chyba při generování exportu.', 'Could not generate the export.'],
        ['Ошибка экспорта', 'Chyba exportu', 'Export error'], ['Не удалось создать маску стен для чертежа.', 'Masku stěn výkresu nelze vytvořit.', 'Could not create the drawing wall mask.'],
        ['Načítání projektu...', 'Loading project…'], ['Terén', 'Ground'],
        ['Откройте меню GOOM', 'Otevřete nabídku GOOM', 'Open the GOOM menu'], ['Чтобы загрузить план этажа, нажмите на значок GOOM в верхней панели.', 'Výkres podlaží nahrajete pomocí ikony GOOM v horní liště.', 'To upload a floor plan, select the GOOM icon in the top toolbar.'],
        ['Загрузите план', 'Nahrajte výkres', 'Upload a plan'], ['Выберите изображение или PDF с планом. После загрузки можно будет размещать на нём датчики.', 'Vyberte obrázek nebo PDF výkresu. Po načtení můžete rozmístit detektory.', 'Choose an image or PDF plan. You can place detectors once it has loaded.'],
        ['Выберите датчик', 'Vyberte detektor', 'Choose a detector'], ['Разверните панель инструментов, выберите датчик, затем щёлкните по плану, чтобы его поставить.', 'Rozbalte panel nástrojů, vyberte detektor a umístěte jej kliknutím nebo klepnutím do výkresu.', 'Expand the toolbar, choose a detector, then click or tap the plan to place it.'],
        ['Работайте с планом', 'Pracujte s výkresem', 'Work with the plan'], ['Перетаскивайте датчики мышью. Чтобы выделить несколько, зажмите левую кнопку и протяните рамку.', 'Detektory přesouvejte tažením. Více prvků označíte výběrovým rámečkem. Na tabletu použijte dva prsty pro posun a přiblížení.', 'Drag detectors to move them. Drag a selection box to select several. On a tablet, use two fingers to pan and zoom.'],
        ['Шаг {0} из {1}', 'Krok {0} z {1}', 'Step {0} of {1}'], ['Готово', 'Hotovo', 'Done'], ['Далее', 'Dále', 'Next'],
        ['Управляющая панель', 'Ústředna', 'Control panel'], ['Расширитель', 'Expandér', 'Expander'], ['Беспроводной модуль', 'Bezdrátový modul', 'Wireless module'],
        ['Клавиатура', 'Klávesnice', 'Keypad'], ['PIR датчик', 'PIR detektor', 'PIR detector'], ['Беспроводной PIR', 'Bezdrátový PIR', 'Wireless PIR'],
        ['Магнитный контакт', 'Magnetický kontakt', 'Magnetic contact'], ['Беспроводной контакт', 'Bezdrátový kontakt', 'Wireless contact'], ['Датчик разбития стекла', 'Detektor tříštění skla', 'Glass-break detector'],
        ['Тревожная кнопка', 'Tísňové tlačítko', 'Panic button'], ['Сирена', 'Siréna', 'Siren'], ['Цвет {0}', 'Barva {0}', 'Color {0}'],
        ['Не удалось загрузить созданный значок устройства: {0}', 'Vlastní ikonu zařízení nelze načíst: {0}', 'Could not load the custom device icon: {0}'],
        ['Выберите фигуру или добавьте новую.', 'Vyberte tvar nebo přidejte nový.', 'Select a shape or add a new one.'],
        ['Выбрана фигура {0} из {1}. Перетаскивайте её мышью.', 'Vybraný tvar {0} z {1}. Přesuňte jej tažením.', 'Shape {0} of {1} selected. Drag to move it.'],
        ['Текст фигуры', 'Text tvaru', 'Shape text'], ['Центральный блок', 'Ústředna', 'Control panel'], ['PIR-датчик', 'PIR detektor', 'PIR detector'],
        ['Текстовая заметка', 'Textová poznámka', 'Text note'], ['Основное меню', 'Hlavní nabídka', 'Main menu'], ['Меню {0}', 'Nabídka {0}', 'Menu {0}'],
        ['Не удалось сохранить наборы меню в этом браузере.', 'Sady nabídek nelze v tomto prohlížeči uložit.', 'Could not save menu sets in this browser.'], ['Ошибка сохранения', 'Chyba ukládání', 'Save error'],
        ['Текущий набор: {0}. Нажмите, чтобы переключить', 'Aktuální sada: {0}. Kliknutím přepnete', 'Current set: {0}. Click to switch'],
        ['Текущий набор меню: {0}. Переключить набор', 'Aktuální sada nabídek: {0}. Přepnout sadu', 'Current menu set: {0}. Switch set'], ['Выбранное меню', 'Vybraná nabídka', 'Selected menu'],
        ['Название меню: {0}', 'Název nabídky: {0}', 'Menu name: {0}'], ['Выбрать значок: {0}', 'Vybrat ikonu: {0}', 'Select icon: {0}'],
        ['Удалить меню «{0}»', 'Odstranit nabídku „{0}“', 'Delete menu “{0}”'], ['Можно создать не более 7 меню', 'Lze vytvořit nejvýše 7 nabídek', 'You can create up to 7 menus'],
        ['Добавить меню', 'Přidat nabídku', 'Add menu'], ['Есть несохранённые изменения', 'Máte neuložené změny', 'You have unsaved changes'],
        ['Этот набор используется на панели', 'Tato sada se používá v panelu', 'This set is used in the toolbar'], ['Выберите набор, измените его и сохраните', 'Vyberte sadu, upravte ji a uložte', 'Choose a set, edit it, and save'],
        ['Сохранить меню', 'Uložit nabídku', 'Save menu'], ['Сохранено', 'Uloženo', 'Saved'], ['Отбросить несохранённые изменения?', 'Zahodit neuložené změny?', 'Discard unsaved changes?'],
        ['Закрыть редактор меню без сохранения изменений?', 'Zavřít editor nabídek bez uložení změn?', 'Close the menu editor without saving?'],
        ['Достигнут лимит в 7 меню.', 'Byl dosažen limit 7 nabídek.', 'The limit of 7 menus has been reached.'], ['Лимит меню', 'Limit nabídek', 'Menu limit'],
        ['Сохранить текущие изменения перед созданием меню?', 'Uložit aktuální změny před vytvořením nabídky?', 'Save the current changes before creating a menu?'],
        ['Удалить меню «{0}»?', 'Odstranit nabídku „{0}“?', 'Delete menu “{0}”?'], ['Укажите название набора меню.', 'Zadejte název sady nabídek.', 'Enter a name for the menu set.'],
        ['Название меню', 'Název nabídky', 'Menu name'], ['Выберите хотя бы один датчик или инструмент для набора меню.', 'Vyberte do sady alespoň jeden detektor nebo nástroj.', 'Choose at least one detector or tool for this menu set.'],
        ['Пустое меню', 'Prázdná nabídka', 'Empty menu'], ['Создайте дополнительные наборы в редакторе меню', 'Další sady vytvoříte v editoru nabídek', 'Create additional sets in the menu editor'],
        ['Откройте GOOM на планшете или ПК', 'Otevřete GOOM na tabletu nebo počítači', 'Open GOOM on a tablet or computer'], ['Увеличьте ширину окна', 'Zvětšete šířku okna', 'Make the window wider'],
        ['Версия для телефонов недоступна. Для работы с проектами используйте планшет, ноутбук или компьютер.', 'Verze pro telefony není dostupná. Použijte tablet, notebook nebo počítač.', 'The phone version is unavailable. Use a tablet, laptop, or desktop computer.'],
        ['Для работы с планом нужна ширина окна от 600 пикселей. Разверните окно или поверните планшет.', 'Pro práci s výkresem je potřeba šířka okna alespoň 600 pixelů. Zvětšete okno nebo otočte tablet.', 'Working with plans requires a window at least 600 pixels wide. Enlarge the window or rotate your tablet.'],
        ['Не удалось загрузить приложение. Обновите страницу и попробуйте снова.', 'Aplikaci nelze načíst. Obnovte stránku a zkuste to znovu.', 'Could not load the application. Refresh the page and try again.'],
        ['Для работы с проектами используйте планшет, ноутбук или компьютер.', 'Pro práci s projekty použijte tablet, notebook nebo počítač.', 'Use a tablet, laptop, or desktop computer to work on projects.'],
        ['Удерживать: вращение с паузой на 90°', 'Podržet: otáčení se zastavením po 90°', 'Hold: rotate with pauses at 90°'],
        ['Zpět', 'Back'], ['Smazat', 'Delete'], ['Kopírovat/Vložit', 'Copy/Paste'], ['SŘEZ BUDOVY', 'ŘEZ BUDOVOU', 'BUILDING SECTION'],
        ['Добро пожаловать!', 'Vítejte!', 'Welcome!'], ['Войдите в аккаунт Google, чтобы перейти к своим проектам.', 'Přihlaste se a pokračujte ke svým projektům.', 'Sign in to continue to your projects.'],
        ['Войти или зарегистрироваться с Google', 'Pokračovat s Google', 'Continue with Google'], ['Выйти', 'Odhlásit se', 'Sign out'],
        ['Перейти к проектам', 'Přejít k projektům', 'Continue to projects'], ['Выберите проект', 'Vyberte projekt', 'Choose a project'],
        ['Продолжить последний проект', 'Pokračovat v posledním projektu', 'Resume the last project'], ['Otevřít projekt (.TECH)', 'Open project (.TECH)'],
        ['Назад к аккаунту', 'Zpět k účtu', 'Back to account'], ['Zadejte název projektu:', 'Enter a project name:'], ['Zrušit', 'Cancel'], ['Vytvořit', 'Create'],
        ['Закрыть', 'Zavřít', 'Close'], ['Сохранить текущий проект', 'Uložit aktuální projekt', 'Save current project'], ['Обновить', 'Obnovit', 'Refresh'],
        ['Отмена', 'Zrušit', 'Cancel'], ['Пропустить', 'Přeskočit', 'Skip'], ['Nahrát výkres (PDF/IMG)', 'Upload plan (PDF/IMG)'], ['Uložit / Export', 'Save / Export'], ['Tisk', 'Print'],
        ['Распознавание стен и PIR', 'Rozpoznání stěn a PIR', 'Wall detection and PIR'], ['Порог яркости стен (0–255)', 'Práh jasu stěn (0–255)', 'Wall brightness threshold (0–255)'],
        ['Тёмные пиксели на плане становятся преградами для лучей PIR. Уменьшите порог, если текст или мебель ошибочно блокируют обзор.', 'Tmavé pixely výkresu tvoří překážky pro paprsky PIR. Pokud text nebo nábytek nesprávně blokují výhled, snižte práh.', 'Dark plan pixels block PIR rays. Lower the threshold if text or furniture incorrectly blocks coverage.'],
        ['Для выбранного датчика задаётся его радиус; если PIR не выбран — это радиус для новых датчиков. Угол обзора фиксированный: 90°.', 'Dosah platí pro vybraný detektor; bez výběru PIR se použije pro nové detektory. Zorný úhel je pevně 90°.', 'Range applies to the selected detector, or to new detectors if no PIR is selected. The field of view is fixed at 90°.'],
        ['Условный радиус луча, px (10–2000)', 'Dosah paprsku, px (10–2000)', 'Ray range, px (10–2000)'], ['Применить', 'Použít', 'Apply'],
        ['Редактор меню и значков', 'Editor nabídek a ikon', 'Menu and icon editor'], ['Значок датчика', 'Ikona detektoru', 'Detector icon'],
        ['Цвет', 'Barva', 'Color'], ['Другой цвет', 'Vlastní barva', 'Custom color'], ['Заливка фигуры', 'Výplň tvaru', 'Fill shape'],
        ['Размер', 'Velikost', 'Size'], ['Толщина линии', 'Tloušťka čáry', 'Line width'], ['Поворот', 'Otočení', 'Rotation'],
        ['Очистить', 'Vymazat', 'Clear'], ['Сбросить', 'Obnovit výchozí', 'Reset'], ['Exportovat projekt', 'Export project'],
        ['Zvolte formát pro uložení. .TECH slouží pro opětovné otevření a úpravu projektu.', 'Choose a save format. Use .TECH to reopen and edit the project.'],
        ['Uložit Projekt (.TECH)', 'Save project (.TECH)'], ['Export jako Obrázek (PNG)', 'Export image (PNG)'], ['Export jako Dokument (PDF)', 'Export document (PDF)'],
        ['Poznámka / Text', 'Note / Text'], ['Uložit text', 'Save text'], ['Adresa prvku', 'Device address'], ['Smažte pole pro návrat na "Auto".', 'Clear the field to return to “Auto”.'],
        ['❌ Adresa je obsazena!', '❌ This address is already used!'], ['Typ prvku', 'Device type'], ['Adresa:', 'Address:'], ['Sběrnice: 1', 'Bus: 1'],
        ['Tajný režim RAMEN!', 'Secret RAMEN mode!'], ['Nástroj pro přidání čerstvého ramenu byl aktivován. Můžete zapojovat nudlové kabely!', 'The fresh ramen tool is active. You can connect noodle cables!'], ['Chutné!', 'Delicious!'],
        ['Indikátory: Počet aktivních prvků', 'Indicators: active device count'], ['Kliknutím na podlaží jej otevřete', 'Select a floor to open it'], ['NÁVRAT ZPĚT', 'BACK'],
        ['Меню', 'Nabídka', 'Menu'], ['Název projektu...', 'Project name…'], ['Přejmenovat projekt', 'Rename project'],
        ['Размер значков датчиков', 'Velikost ikon detektorů', 'Detector icon size'], ['Změnit velikost všech značek', 'Change the size of all icons'],
        ['Показать сетку поверх чертежа', 'Zobrazit mřížku nad výkresem', 'Show grid over the plan'], ['Настроить стены и диапазон PIR', 'Nastavit stěny a dosah PIR', 'Configure walls and PIR range'],
        ['Редактировать меню и значки', 'Upravit nabídky a ikony', 'Edit menus and icons'], ['Zobrazit / Skrýt panel nástrojů', 'Show / Hide toolbar'],
        ['Переключить набор меню', 'Přepnout sadu nabídek', 'Switch menu set'], ['Vyberte Sběrnici', 'Choose a bus'], ['Expandér zón/výstupů (EXP)', 'Zone/output expander (EXP)'],
        ['Bezdrátový modul ABAX2', 'ABAX2 wireless module'], ['Klávesnice EZS', 'Alarm keypad'], ['Prostorový PIR detektor', 'PIR motion detector'],
        ['Bezdrátový PIR detektor', 'Wireless PIR detector'], ['Bezdrátový Magnetický kontakt', 'Wireless magnetic contact'], ['Detektor tříštění skla', 'Glass-break detector'],
        ['Tísňové tlačítko (PANIC)', 'Panic button (PANIC)'], ['Přidat textovou poznámku', 'Add a text note'], ['Skrýt / Zobrazit čáry kabelů', 'Hide / Show cable lines'],
        ['Klávesové zkratky (Nápověda)', 'Keyboard shortcuts (Help)'], ['Přehled celé budovy', 'Building overview'], ['Добро пожаловать в GOOM', 'Vítejte v GOOM', 'Welcome to GOOM'],
        ['Войти или зарегистрироваться через Google', 'Přihlásit se nebo registrovat přes Google', 'Sign in or register with Google'], ['Např. Rodinný dom Praha...', 'Např. Rodinný dům Praha…', 'E.g. Family house, Prague…'],
        ['Закрыть облачные проекты', 'Zavřít cloudové projekty', 'Close cloud projects'], ['Закрыть редактор', 'Zavřít editor', 'Close editor'],
        ['Меню и датчики для редактирования', 'Nabídky a detektory k úpravě', 'Menus and detectors to edit'], ['Тип устройства для значка', 'Typ zařízení pro ikonu', 'Device type for the icon'],
        ['Холст редактирования значка', 'Plátno editoru ikon', 'Icon editing canvas'], ['Действия с холстом', 'Akce plátna', 'Canvas actions'], ['Отменить действие', 'Vrátit akci', 'Undo'],
        ['Добавить фигуру', 'Přidat tvar', 'Add shape'], ['Круг', 'Kruh', 'Circle'], ['Квадрат', 'Čtverec', 'Square'], ['Скруглённый квадрат', 'Zaoblený čtverec', 'Rounded square'],
        ['Треугольник', 'Trojúhelník', 'Triangle'], ['Ромб', 'Kosočtverec', 'Diamond'], ['Линия', 'Čára', 'Line'], ['Текст', 'Text', 'Text'],
        ['Палитра цветов', 'Paleta barev', 'Color palette'], ['Выбрать другой цвет', 'Vybrat vlastní barvu', 'Choose a custom color'],
        ['Удалить фигуру', 'Odstranit tvar', 'Delete shape'], ['Сбросить значок', 'Obnovit výchozí ikonu', 'Reset icon'], ['Zadejte text...', 'Enter text…'],
        ['Uložit', 'Save'], ['Návrat na půdorys', 'Return to floor plan'], ['Skrýt kabely', 'Hide cables'], ['Zobrazit kabely', 'Show cables'],
        ['PIR Detektor', 'PIR detector'], ['Modul ABAX2', 'ABAX2 module'],
        // Registration, account, and company cloud access.
        ['Jazyk', 'Language'], ['Zpět', 'Back'], ['Přihlásit se e-mailem', 'Sign in with email'], ['Vytvořit účet', 'Create an account'],
        ['Přihlášení', 'Sign in'], ['Registrace', 'Registration'], ['E-mail', 'Email'], ['Heslo', 'Password'], ['Potvrdit heslo', 'Confirm password'],
        ['Jméno', 'Name'], ['Typ účtu', 'Account type'], ['Osobní účet', 'Personal account'], ['Firma', 'Company'], ['IČO', 'Company ID (IČO)'],
        ['8 číslic včetně kontrolní číslice', '8 digits including the check digit'], ['Přihlásit se', 'Sign in'], ['Registrovat', 'Register'], ['Zapomenuté heslo?', 'Forgot password?'],
        ['Použijte libovolnou e-mailovou adresu. Heslo musí mít alespoň 8 znaků.', 'Use any email address. Your password must contain at least 8 characters.'],
        ['Po ověření e-mailu získá firemní účet automaticky klíč ke cloudovému úložišti.', 'After email verification, a company account automatically receives a cloud storage key.'],
        ['Uživatelský účet', 'User account'], ['Údaje uživatele', 'User information'], ['Nastavení účtu', 'Account settings'], ['Uložit údaje', 'Save details'],
        ['Ověřit e-mail', 'Verify email'], ['E-mail jsem ověřil(a)', 'I have verified my email'], ['E-mail je ověřen', 'Email verified'],
        ['E-mail zatím není ověřen', 'Email not verified yet'], ['Cloudové úložiště', 'Cloud storage'], ['Cloudový klíč', 'Cloud key'],
        ['Zkopírovat klíč', 'Copy key'], ['Vygenerovat nový klíč', 'Generate a new key'], ['Klíč byl zkopírován.', 'Key copied.'],
        ['Klíč uložte na bezpečné místo. Plný klíč se zobrazí pouze po jeho vydání.', 'Store the key in a safe place. The full key is shown only when issued.'],
        ['Klíč je vydán pro tento firemní účet. Cloudové projekty jsou dostupné.', 'A key has been issued for this company account. Cloud projects are available.'],
        ['Cloudové úložiště je dostupné firemním účtům s vydaným klíčem.', 'Cloud storage is available to company accounts with an issued key.'],
        ['Pro automatické vydání klíče ověřte svůj e-mail.', 'Verify your email to receive a key automatically.'],
        ['Zadejte platné osmimístné IČO.', 'Enter a valid eight-digit Czech company ID (IČO).'], ['Zadejte své jméno.', 'Enter your name.'],
        ['Hesla se neshodují.', 'The passwords do not match.'], ['Heslo musí mít alespoň 8 znaků.', 'Your password must contain at least 8 characters.'],
        ['Zadejte platnou e-mailovou adresu.', 'Enter a valid email address.'], ['Vyplňte e-mail a heslo.', 'Enter your email and password.'],
        ['Tato e-mailová adresa již má účet. Přihlaste se nebo obnovte heslo.', 'This email address already has an account. Sign in or reset your password.'],
        ['Nesprávný e-mail nebo heslo.', 'Incorrect email or password.'], ['Přihlášení e-mailem není ve Firebase povoleno.', 'Email/password sign-in is not enabled in Firebase.'],
        ['Příliš mnoho pokusů. Zkuste to později.', 'Too many attempts. Try again later.'], ['Zkontrolujte připojení k internetu.', 'Check your internet connection.'],
        ['Ověřovací e-mail byl odeslán. Po potvrzení klikněte na „E-mail jsem ověřil(a)“.', 'Verification email sent. After confirming it, select “I have verified my email”.'],
        ['Pokud účet existuje, obdržíte e-mail pro obnovení hesla.', 'If the account exists, you will receive a password reset email.'],
        ['Údaje účtu byly uloženy.', 'Account details saved.'], ['Načítání údajů účtu…', 'Loading account details…'],
        ['Údaje účtu nelze načíst. Zkuste to znovu.', 'Could not load account details. Try again.'],
        ['Cloudový klíč nelze vydat. Zkuste to znovu.', 'Could not issue the cloud key. Try again.'],
        ['Obnovit údaje', 'Refresh account details'], ['Vydávání cloudového klíče…', 'Issuing a cloud key…'],
        ['Vygenerovat nový klíč? Předchozí klíč bude nahrazen.', 'Generate a new key? The previous key will be replaced.'],
        ['Přihlaste se ke svému účtu.', 'Sign in to your account.'], ['Ukládání…', 'Saving…'], ['Registrace se nezdařila', 'Registration failed'],
        ['Přihlášení se nezdařilo', 'Sign-in failed'], ['Účet je založen, ale údaje se nepodařilo uložit. Doplňte je v nastavení účtu.', 'Your account was created, but its details could not be saved. Complete them in account settings.'],
        ['Ověření e-mailu se nepodařilo odeslat. Zkuste to z nastavení účtu.', 'Could not send the verification email. Try again from account settings.'],
        ['PRO je aktivní.', 'PRO is active.'], ['Váš účet používá bezplatnou verzi.', 'Your account is on the free plan.'],
        ['PRO je aktivní. Cloudové úložiště je připraveno.', 'PRO is active. Cloud storage is ready.'], ['Cloudové úložiště je součástí PRO.', 'Cloud storage is included in PRO.'],
        ['Cena a podmínky se zobrazí na zabezpečené platební stránce.', 'The price and terms are shown on the secure payment page.'],
        ['Před nákupem potvrďte svou e-mailovou adresu v nastavení účtu.', 'Before purchasing, confirm your email in account settings.'],
        ['Připravujeme zabezpečenou platbu…', 'Preparing secure checkout…'], ['Platbu nyní nelze otevřít. Zkuste to později.', 'Checkout is unavailable. Please try again later.'],
        ['Ověřujeme platbu. PRO se aktivuje po potvrzení úhrady.', 'Verifying payment. PRO activates after payment is confirmed.'],
        ['Platba byla zrušena. Váš účet zůstává beze změny.', 'Payment was cancelled. Your account is unchanged.'],
        ['Rozšiřte svůj účet o nástroje PRO.', 'Upgrade your account with PRO tools.'], ['Cloudové ukládání plánů', 'Cloud plan storage'],
        ['Editor nabídek a ikon', 'Menu and icon editor'], ['Tipy při plánování', 'Planning hints'], ['Koupit PRO', 'Buy PRO'],
        ['Jednorázová licence pro PZTS', 'One-time PZTS license'], ['PZTS, EPS, CCTV a SK', 'PZTS, EPS, CCTV and SK'],
        ['Firemní údaje můžete upravit později. PRO je dostupné v uživatelském účtu.', 'You can edit company details later. PRO is available in your account.'],
        ['Ovládání detektoru', 'Detector controls'], ['Výběr', 'Select'], ['Posun', 'Pan'], ['Výběr detektoru', 'Select detector'],
        ['Posun plánu', 'Pan plan'], ['Otočit o 90°', 'Rotate 90°'], ['Duplikovat', 'Duplicate'], ['Odstranit vybrané', 'Delete selected'],
        ['Synchronizace je připravena', 'Sync is ready'], ['Místní ukládání', 'Local saving'],
        ['PZTS PRO — 39 € / měsíc', 'PZTS PRO — €39 / month'], ['PRO Suite — 99 € / měsíc', 'PRO Suite — €99 / month'],
        ['Měsíční předplatné PZTS', 'Monthly PZTS subscription'], ['Měsíčně: PZTS, EPS, CCTV a SK', 'Monthly: PZTS, EPS, CCTV and SK'],
        ['Předplatné se obnovuje každý měsíc od data nákupu. Automatické obnovení můžete zrušit v účtu.', 'Your subscription renews monthly from the purchase date. You can cancel automatic renewal in your account.'],
        ['Spravovat předplatné', 'Manage subscription'], ['Přístup do: {0}', 'Access until: {0}'],
        ['Automatické obnovení je vypnuto.', 'Automatic renewal is off.'], ['Měsíční předplatné.', 'Monthly subscription.'],
        ['Správu předplatného nyní nelze otevřít. Zkuste to později.', 'Subscription management is unavailable. Please try again later.'], ['Adresa', 'Address'],
        ['Máte již předplatné. Spravujte je v uživatelském účtu.', 'You already have a subscription. Manage it in your account.'],
        ["Zobrazení výkresu","Drawing appearance"],
        ["Bílé čáry na tmavém pozadí","White lines on a dark background"],
        ["Původní výkres","Original drawing"],
        ["Stěny se rozpoznávají z původního výkresu bez ohledu na barvu zobrazení. Tmavý text a nábytek mohou také blokovat paprsky. Práh upravte podle podkladu.","Walls are detected from the original drawing regardless of its display colours. Dark text and furniture can also block rays. Adjust the threshold to suit your source."],
        ["Výkres nelze načíst.","Could not load the drawing."],
        ["Knihovna PDF není dostupná.","The PDF library is unavailable."],
        ["Knihovna DXF není dostupná.","The DXF library is unavailable."],
        ["DXF neobsahuje podporované čáry.","The DXF contains no supported lines."],
        ["Číslo stránky PDF (1–{0})","PDF page number (1–{0})"],
        ["Import PDF","Import PDF"],
        ["Import DXF","Import DXF"],
        ["Neplatné číslo stránky.","Invalid page number."],
        ["Obrázek je příliš velký. Použijte nejvýše 24 Mpx a stranu 16000 px.","The image is too large. Use at most 24 MP and a side length of 16000 px."],
        ["Nepodporované prvky DXF: {0}","Unsupported DXF entities: {0}"],
        ["Chyba načítání výkresu","Drawing import error"],
        ["Celé podlaží, nezávisle na přiblížení obrazovky.","The entire floor, independent of your screen zoom."],
        ["Formát papíru","Paper size"],
        ["Orientace","Orientation"],
        ["Automaticky","Automatic"],
        ["Na šířku","Landscape"],
        ["Na výšku","Portrait"],
        ["Kvalita","Quality"],
        ["Pozadí","Background"],
        ["Světlý výkres","Light drawing"],
        ["Tmavý výkres","Dark drawing"],
        ["Zóny detektorů","Detector coverage"],
        ["SVG zachová vektorové čáry DXF, detektory a kabely. Fotografie a rastrové plány zůstanou rastrové.","SVG preserves DXF vector lines, detectors and cables. Photos and raster plans remain raster images."],
        ["Náhled celého podlaží","Full floor preview"],
        ["Výstup je příliš velký.","The output is too large."],
        ["Příprava výstupu…","Preparing output…"],
        ["Výstup nelze uložit.","Could not save the output."],
        ["Výstup je připraven.","The output is ready."],
        ["Výstup se nezdařil.","Output failed."],
        ['Zvýraznit rozpoznané překážky','Highlight detected obstacles'],
        ["Citlivost rozpoznání stěn","Wall detection sensitivity"],
        ["Bez překážek","No obstacles"],
        ["I jemné čáry","Even faint lines"],
        ["Citlivost se projeví ihned. Vyšší hodnota zachytí i světlé čáry; text a nábytek mohou být také překážkou.","Sensitivity updates immediately. Higher values detect faint lines; text and furniture may also be obstacles."],
        ["PŘEHLED BUDOVY","BUILDING OVERVIEW"],
        ["Dům, průmyslová budova a věž","House, industrial building and tower"],
        ["Podlaží","Floors"],
        ["Adresy zón","Zone addresses"],
        ["Bez zón","No zones"],
        ["Bez ústředny","No control panel"],
        ["Ústředna","Control panel"],
        ["detektorů","detectors"],
        ["Detektory: {0}","Detectors: {0}"],
        ["Zóny: {0}","Zones: {0}"],
        ["Prvky: {0}","Devices: {0}"],
        ["Ústředny: {0}","Control panels: {0}"],
        ["Ústředna: {0}","Control panel: {0}"],
        ["Ústředna není umístěna","No control panel placed"],
        ["Hlavní ústředna","Main control panel"],
        ["Hlavní ústředna: {0}","Main control panel: {0}"],
        ["detektor","detector"],
        ["detektory","detectors"],
        ["PIR detektor","PIR detector"],
        ["Bezdrátový magnet","Wireless contact"],
        ["Detektor rozbití skla","Glass-break detector"],
        ["Neaktivní detektor","Inactive detector"],
        ["Detektor","Detector"],
        ["Otočit doleva","Rotate left"],
        ["Otočit doprava","Rotate right"],
        ["Podržet: otočit doprava / doleva","Hold: rotate right / left"],
        ['Vyberte podlaží', 'Select a floor'], ['Zpět na půdorys', 'Back to plan'], ['Počet prvků: {0}', 'Device count: {0}'], ['ZPĚT', 'BACK']
    ];

    const catalog = new Map();
    for (const row of rows) {
        const [source, cs, en] = row.length === 2 ? [row[0], row[0], row[1]] : row;
        const entry = { cs, en };
        for (const alias of [source, cs, en]) if (!catalog.has(alias)) catalog.set(alias, entry);
    }
    let language = 'cs';
    try { if (localStorage.getItem('goom.language') === 'en') language = 'en'; } catch {}
    const bindings = new WeakMap();
    const renderedMessages = new Map();
    const protectedSelector = 'script,style,textarea,[data-user-content],#googleAuthUser,#cloudProjectsUser,#overviewProjectNameDisplay,#ttName,.floor-name';
    const format = (source, values) => source.replace(/\{(\d+)\}/g, (_, n) => String(values[Number(n)] ?? ''));
    window.tr = (source, ...values) => {
        if (Array.isArray(source)) source = source.map((part, i) => part + (i < values.length ? `{${i}}` : '')).join('');
        if (renderedMessages.has(source) && !catalog.has(source) && !values.length) {
            const rendered = renderedMessages.get(source);
            return tr(rendered.source, ...rendered.values);
        }
        if (values.length && catalog.has(source)) {
            const entry = catalog.get(source);
            for (const candidate of [format(entry.cs, values), format(entry.en, values)]) renderedMessages.set(candidate, { source, values });
            while (renderedMessages.size > 5000) renderedMessages.delete(renderedMessages.keys().next().value);
        }
        return format(catalog.get(String(source))?.[language] ?? String(source), values);
    };
    window.getGoomLanguage = () => language;
    window.getGoomLocale = () => language === 'cs' ? 'cs-CZ' : 'en-GB';

    function localizeText(node) {
        if (!node.parentElement || node.parentElement.closest(protectedSelector)) return;
        const value = node.nodeValue;
        const previous = bindings.get(node);
        const source = previous && previous.last === value ? previous.source : value.trim();
        if (!catalog.has(source) && !renderedMessages.has(source)) return;
        const translated = value.replace(value.trim(), tr(source));
        bindings.set(node, { source, last: translated });
        if (node.nodeValue !== translated) node.nodeValue = translated;
    }
    function localizeElement(element) {
        if (element.closest(protectedSelector)) return;
        for (const attr of ['title', 'aria-label', 'placeholder', 'data-tooltip']) {
            const value = element.getAttribute(attr);
            if (!value) continue;
            const key = `i18n-${attr}`;
            let source = element.getAttribute(key);
            if (!source || value !== tr(source)) source = value;
            if (catalog.has(source) || renderedMessages.has(source)) {
                element.setAttribute(key, source);
                const translated = tr(source);
                if (value !== translated) element.setAttribute(attr, translated);
            }
        }
    }
    function localize(root = document.body) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) { localizeText(root); return; }
        if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            if (walker.currentNode.nodeType === Node.TEXT_NODE) localizeText(walker.currentNode);
            else localizeElement(walker.currentNode);
        }
    }
    window.localizeGoom = localize;
    window.setGoomLanguage = value => {
        language = value === 'en' ? 'en' : 'cs';
        document.documentElement.lang = language;
        try { localStorage.setItem('goom.language', language); } catch {}
        localize();
        document.querySelectorAll('[data-language-select]').forEach(select => { select.value = language; });
        window.dispatchEvent(new Event('goom-language-changed'));
        window.requestRedraw?.();
    };
    document.documentElement.lang = language;
    document.addEventListener('DOMContentLoaded', () => {
        localize();
        document.querySelectorAll('[data-language-select]').forEach(select => {
            select.value = language;
            select.addEventListener('change', () => window.setGoomLanguage(select.value));
        });
        const observer = new MutationObserver(records => {
            for (const record of records) {
                if (record.type === 'characterData') localizeText(record.target);
                else if (record.type === 'attributes') localizeElement(record.target);
                else record.addedNodes.forEach(localize);
            }
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder', 'data-tooltip'] });
    });
    // Exposed only for static source coverage checks.
    window.GOOM_TRANSLATION_ROWS = rows;
})();
