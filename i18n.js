// Czech is the default. Source aliases also cover labels in older saved menu sets.
(() => {
    const rows = [
        ['Velikost písma', 'Font size', 'Schriftgröße', 'Размер шрифта'],
        ['Modul přístupového systému (ACS)', 'Access control module (ACS)', 'Zutrittskontrollmodul (ACS)', 'Модуль контроля доступа (ACS)'],
        ['Čtečka přístupového systému (ACS)', 'Access control reader (ACS)', 'Zutrittsleser (ACS)', 'Считыватель системы контроля доступа (ACS)'],
        ['Kouřový hlásič', 'Smoke detector', 'Rauchmelder', 'Дымовой извещатель'],
        ['Poplachový zabezpečovací a tísňový systém', 'Intruder and hold-up alarm system', 'Einbruch- und Überfallmeldeanlage', 'Система охранной и тревожной сигнализации'],
        ['Pro práci s výkresy a ukládání do zařízení.', 'For editing drawings and saving on your device.', 'Zum Bearbeiten von Plänen und Speichern auf Ihrem Gerät.', 'Для работы с чертежами и сохранения на устройство.'],
        ['Pro práci napříč zařízeními a s vlastními symboly.', 'For working across devices with your own symbols.', 'Für geräteübergreifendes Arbeiten mit eigenen Symbolen.', 'Для работы на нескольких устройствах и со своими значками.'],
        ['Jedno předplatné pro vás a vaše kolegy.', 'One subscription for you and your colleagues.', 'Ein Abo für Sie und Ihre Kollegen.', 'Одна подписка для вас и ваших коллег.'],
        ['Vše z PROJECT', 'Everything in PROJECT', 'Alles aus PROJECT', 'Всё из PROJECT'],
        ['Odstranit vybrané prvky?', 'Delete selected devices?', 'Ausgewählte Geräte löschen?', 'Удалить выбранные устройства?'],
        ['Ponechte mezeru v adresách, nebo posuňte další automaticky číslované prvky.', 'Keep the gap in the addresses or shift the numbers of subsequent automatically numbered devices.', 'Lassen Sie die Adresslücke bestehen oder verschieben Sie die Nummern der nachfolgenden automatisch nummerierten Geräte.', 'Оставьте пропуск в адресах или сдвиньте номера следующих устройств с автоматической нумерацией.'],
        ['Odstranit a ponechat mezeru', 'Delete and keep the gap', 'Löschen und Lücke lassen', 'Удалить и оставить пропуск'],
        ['Odstranit a přečíslovat', 'Delete and renumber', 'Löschen und neu nummerieren', 'Удалить и сдвинуть номера'],
        ['Publikovat sdílenou sadu', 'Publish shared preset', 'Gemeinsame Vorlage veröffentlichen', 'Опубликовать общий набор'],
        ['Publikujeme…', 'Publishing…', 'Wird veröffentlicht…', 'Публикуем…'],
        ['Importovat osobní nabídky', 'Import personal menus', 'Persönliche Menüs importieren', 'Импортировать личные меню'],
        ['Přidat starší osobní nabídky z tohoto prohlížeče k právě přihlášenému účtu?', 'Add older personal menus from this browser to the signed-in account?', 'Ältere persönliche Menüs aus diesem Browser dem angemeldeten Konto hinzufügen?', 'Добавить старые личные меню из этого браузера в текущий аккаунт?'],
        ['Použít starší nabídku z tohoto zařízení', 'Use older preset from this device', 'Ältere Vorlage dieses Geräts verwenden', 'Взять старый набор с этого устройства'],
        ['Sdílenou nabídku nelze uložit. Zkontrolujte připojení a pravidla Firebase.', 'Could not publish the shared preset. Check your connection and Firebase rules.', 'Die gemeinsame Vorlage konnte nicht veröffentlicht werden. Prüfen Sie die Verbindung und die Firebase-Regeln.', 'Не удалось опубликовать общий набор. Проверьте подключение и правила Firebase.'],
        ['Světlý a tmavý výkres', 'Light and dark drawing modes', 'Heller und dunkler Planmodus', 'Светлый и тёмный режимы чертежа'],
        ['Sada nástrojů PROJECT', 'PROJECT tool set', 'PROJECT-Werkzeugsatz', 'Набор инструментов PROJECT'],
        ['Průvodce prvním projektem', 'First project guide', 'Einführung ins erste Projekt', 'Помощник по первому проекту'],
        ['Nahrajte výkres', 'Import a drawing', 'Plan importieren', 'Загрузите чертёж'],
        ['V horní liště otevřete nabídku GooM a zvolte Nahrát výkres. Můžete použít PDF, obrázek nebo DXF.', 'Open the GooM menu in the top bar and select Upload plan. You can use PDF, an image, or DXF.', 'Öffnen Sie oben das GooM-Menü und wählen Sie Plan hochladen. Sie können PDF, Bilddateien oder DXF verwenden.', 'Откройте меню GooM в верхней панели и выберите «Загрузить план». Подойдут PDF, изображение или DXF.'],
        ['Umístěte první detektor', 'Place your first detector', 'Ersten Melder platzieren', 'Разместите первый датчик'],
        ['Rozbalte panel nástrojů, vyberte sběrnici a detektor a klepněte nebo klikněte na výkres.', 'Expand the toolbar, select a bus and a detector, then tap or click the drawing.', 'Klappen Sie die Werkzeugleiste aus, wählen Sie einen Bus und einen Melder und tippen oder klicken Sie in den Plan.', 'Разверните панель инструментов, выберите шину и датчик, затем нажмите на чертёж.'],
        ['Upravte polohu a směr', 'Adjust position and rotation', 'Position und Ausrichtung ändern', 'Настройте положение и поворот'],
        ['Detektor přetáhněte na nové místo. Otočíte ho klávesami S a D nebo šipkami u vybraného detektoru na tabletu.', 'Drag the detector to move it. Rotate it with S and D or use the arrows next to the selected detector on a tablet.', 'Ziehen Sie den Melder an die gewünschte Stelle. Drehen Sie ihn mit S und D oder auf dem Tablet mit den Pfeilen am ausgewählten Melder.', 'Перетащите датчик на нужное место. Для поворота используйте S и D или стрелки рядом с выбранным датчиком на планшете.'],
        ['Pracujte s podlažími', 'Work with floors', 'Mit Geschossen arbeiten', 'Работайте с этажами'],
        ['Dole otevřete Řez budovou a vyberte podlaží. Každé podlaží má vlastní výkres a detektory.', 'Open Building section at the bottom and select a floor. Each floor has its own drawing and detectors.', 'Öffnen Sie unten den Gebäudeschnitt und wählen Sie ein Geschoss. Jedes Geschoss hat einen eigenen Plan und eigene Melder.', 'Откройте «Разрез здания» внизу и выберите этаж. У каждого этажа свой чертёж и свои датчики.'],
        ['Uložte nebo vytiskněte projekt', 'Save or print the project', 'Projekt speichern oder drucken', 'Сохраните или распечатайте проект'],
        ['V nabídce GooM vyberte Uložit / Export pro soubor .TECH nebo Tisk pro otevření dialogu tiskárny.', 'In the GooM menu, select Save / Export for a .TECH file or Print to open the system print dialog.', 'Wählen Sie im GooM-Menü Speichern / Exportieren für eine .TECH-Datei oder Drucken für den Systemdialog.', 'В меню GooM выберите «Сохранить / Экспорт» для файла .TECH или «Печать», чтобы открыть системное окно печати.'],
        ['Otevřít cloudové projekty', 'Open cloud projects', 'Cloud-Projekte öffnen', 'Открыть облачные проекты'],
        ['Ukládejte projekty a otevírejte je i z jiného zařízení.', 'Save projects and open them from another device.', 'Speichern Sie Projekte und öffnen Sie sie auf einem anderen Gerät.', 'Сохраняйте проекты и открывайте их с другого устройства.'],
        ['Tarify a předplatné', 'Plans and pricing', 'Tarife und Abos', 'Тарифы и подписки'],
        ['Měsíčně', 'Monthly', 'Monatlich', 'В месяц'],
        ['Ročně', 'Annually', 'Jährlich', 'В год'],
        ['Základní', 'Basic', 'Basis', 'Базовый'],
        ['Zdarma', 'Free', 'Kostenlos', 'Бесплатно'],
        ['Aktivní', 'Active', 'Aktiv', 'Активный'],
        ['Import a úpravy výkresů', 'Import and edit plans', 'Pläne importieren und bearbeiten', 'Импорт и редактирование чертежей'],
        ['Místní uložení projektů .TECH', 'Save .TECH projects locally', '.TECH-Projekte lokal speichern', 'Сохранение проектов .TECH на устройство'],
        ['Export a tisk s vodoznakem', 'Export and print with a watermark', 'Export und Druck mit Wasserzeichen', 'Экспорт и печать с водяным знаком'],
        ['Doporučujeme', 'Recommended', 'Empfohlen', 'Рекомендуем'],
        ['Vše ze základní verze', 'Everything in Basic', 'Alles aus Basis', 'Всё из базовой версии'],
        ['Až 5 projektů v cloudu', 'Up to 5 projects in the cloud', 'Bis zu 5 Projekte in der Cloud', 'До пяти проектов в облаке'],
        ['Vyhledávání detektorů ve všech podlažích', 'Find detectors across all floors', 'Melder auf allen Geschossen suchen', 'Поиск датчиков по всем этажам'],
        ['Firemní PROJECT', 'Company PROJECT', 'PROJECT für Firmen', 'PROJECT для компаний'],
        ['Pro týmy', 'For teams', 'Für Teams', 'Для команд'],
        ['Koupit firemní PROJECT', 'Buy Company PROJECT', 'Firmen-PROJECT kaufen', 'Купить PROJECT для компании'],
        ['Vše z PROJECT včetně tipů při plánování', 'Everything in PROJECT, including planning tips', 'Alles aus PROJECT einschließlich Planungstipps', 'Всё из PROJECT, включая подсказки по проектированию'],
        ['Až 3 další účty PROJECT', 'Up to 3 extra PROJECT accounts', 'Bis zu 3 weitere PROJECT-Konten', 'До трёх дополнительных аккаунтов PROJECT'],
        ['Přístup kolegů po dobu firemního předplatného', 'Colleague access for the duration of the company subscription', 'Mitarbeiterzugang für die Laufzeit des Firmenabos', 'Доступ сотрудников на срок подписки компании'],
        ['Pro nákup firemního PROJECT potřebujete firemní účet.', 'A company account is required to buy Company PROJECT.', 'Für den Kauf von Firmen-PROJECT benötigen Sie ein Firmenkonto.', 'Для покупки фирменного PROJECT нужен аккаунт компании.'],
        ['Předplatné PROJECT', 'PROJECT subscription', 'PROJECT-Abo', 'Подписка PROJECT'],
        ['Co získáte s PROJECT', 'What PROJECT includes', 'Was PROJECT bietet', 'Что входит в PROJECT'],
        ['Obě předplatná odemykají stejné funkce PZTS PROJECT.', 'Both plans unlock the same PZTS PROJECT features.', 'Beide Abos schalten dieselben PZTS-PRO-Funktionen frei.', 'Оба тарифа открывают одинаковые функции PZTS PROJECT.'],
        ['Uložte až 5 projektů a otevřete je z jiného zařízení.', 'Save up to 5 projects and open them from another device.', 'Speichern Sie bis zu 5 Projekte und öffnen Sie sie auf einem anderen Gerät.', 'Храните до пяти проектов и открывайте их с другого устройства.'],
        ['Vytvářejte vlastní sady nástrojů a upravujte symboly detektorů.', 'Create custom tool sets and edit detector symbols.', 'Erstellen Sie eigene Werkzeugsätze und bearbeiten Sie Meldersymbole.', 'Создавайте свои наборы инструментов и редактируйте значки датчиков.'],
        ['Hledejte podle sběrnice a čísla detektoru napříč podlažími.', 'Search across floors by bus and detector number.', 'Suchen Sie geschossübergreifend nach Bus und Meldernummer.', 'Ищите датчики на всех этажах по номеру шины и датчика.'],
        ['Výstupy bez vodoznaku', 'Watermark-free output', 'Ausgabe ohne Wasserzeichen', 'Экспорт без водяного знака'],
        ['Tiskněte a exportujte výkresy bez loga GooM.', 'Print and export drawings without the GooM watermark.', 'Drucken und exportieren Sie Pläne ohne GooM-Wasserzeichen.', 'Печатайте и экспортируйте чертежи без водяного знака GooM.'],
        ['Krátký průvodce nahráním výkresu a rozmístěním detektorů.', 'A quick guide to importing a plan and placing detectors.', 'Eine kurze Einführung in den Planimport und das Platzieren von Meldern.', 'Короткий помощник по загрузке плана и размещению датчиков.'],
        ['Až 3 další účty k placenému firemnímu předplatnému.', 'Up to 3 extra accounts with a paid company subscription.', 'Bis zu 3 zusätzliche Konten bei einem bezahlten Firmenabo.', 'До трёх дополнительных аккаунтов с оплаченной подпиской компании.'],
        ['Zvolte období', 'Billing interval', 'Abrechnungszeitraum', 'Период подписки'],
        ['Platba každý měsíc', 'Billed monthly', 'Monatliche Zahlung', 'Оплата каждый месяц'],
        ['Platba na celý rok', 'Billed annually', 'Jährliche Zahlung', 'Оплата за весь год'],
        ['Bezplatná verze umožňuje kreslit, ukládat projekty .TECH do zařízení a tisknout s vodoznakem.', 'The free plan lets you draw, save .TECH projects on your device and print with a watermark.', 'Im kostenlosen Tarif können Sie zeichnen, .TECH-Projekte lokal speichern und mit Wasserzeichen drucken.', 'В бесплатной версии можно чертить, сохранять проекты .TECH на устройство и печатать с водяным знаком.'],
        ['Otevřete na počítači nebo tabletu', 'Open on a computer or tablet', "Auf einem Computer oder Tablet öffnen", "Откройте на компьютере или планшете"], ['Načítání aplikace…', 'Loading application…', "Anwendung wird geladen…", "Загрузка приложения…"],
        ['Přístup od správce do: {0}', 'Administrator access until: {0}', "Zugang durch Administrator bis: {0}", "Доступ от администратора до {0}"],
        ['Zobrazit legendu', 'Show legend', "Legende einblenden", "Показать легенду"], ['Skrýt legendu', 'Hide legend', "Legende ausblenden", "Скрыть легенду"], ['Legenda:', 'Legend:', "Legende:", "Легенда:"],
        ['Text a poznámky', 'Text and notes', "Text und Notizen", "Текст и заметки"], ['Text na výkresu', 'Plan text', "Plantext", "Текст на плане"], ['Přidat text na výkres', 'Add text to the plan', "Text zum Plan hinzufügen", "Добавить текст на план"],
        ['Sběrnice {0}', 'Bus {0}', "Bus {0}", "Шина {0}"], ['+ Přidat', '+ Add', "+ Hinzufügen", "+ Добавить"],
        ['Ceník PROJECT', 'PROJECT pricing', "PROJECT-Preise", "Тарифы PROJECT"], ['Roční předplatné PZTS', 'Annual PZTS subscription', "PZTS-Jahresabo", "Годовая подписка PZTS"],
        ['Sleva 12 % oproti 12 měsíčním platbám', 'Save 12% compared with 12 monthly payments', "12 % günstiger als 12 Monatszahlungen", "На 12% дешевле 12 ежемесячных платежей"],
        ['Platba v EUR. Ceny v Kč jsou orientační podle kurzu ČNB.', 'Billed in EUR. CZK amounts are estimates based on the Czech National Bank rate.', "Abrechnung in EUR. Die CZK-Beträge basieren auf dem Richtkurs der Tschechischen Nationalbank.", "Оплата в евро. Суммы в кронах рассчитаны ориентировочно по курсу Чешского национального банка."],
        ['Předplatné se obnovuje po zvoleném období. Automatické obnovení můžete zrušit v účtu.', 'Your subscription renews at the selected interval. You can cancel renewal in your account.', "Das Abo verlängert sich im gewählten Rhythmus. Die Verlängerung lässt sich im Konto kündigen.", "Подписка продлевается на выбранный срок. Автопродление можно отключить в аккаунте."],
        ['Roční předplatné.', 'Annual subscription.', "Jahresabo.", "Годовая подписка."], ['Firemní přístup do: {0}', 'Company access until: {0}', "Firmenzugang bis: {0}", "Доступ от компании до {0}"],
        ['Firemní přístupy PROJECT', 'Company PROJECT seats', "PROJECT-Zugänge für Mitarbeitende", "Доступ PROJECT для сотрудников"], ['Uložit přístupy', 'Save seats', "Zugänge speichern", "Сохранить доступы"],
        ['Až tři kolegové získají PROJECT po přihlášení s ověřeným e-mailem. Přístup končí s vaším předplatným.', 'Up to three colleagues get PROJECT when they sign in with a verified email. Access ends with your subscription.', "Bis zu drei Mitarbeitende erhalten PROJECT beim Anmelden mit bestätigter E-Mail-Adresse. Der Zugang endet mit Ihrem Abo.", "До трёх сотрудников получают PROJECT после входа с подтверждённой почтой. Доступ заканчивается вместе с вашей подпиской."],
        ['E-mail kolegy 1', 'Colleague email 1', "E-Mail von Mitarbeiter 1", "Почта сотрудника 1"], ['E-mail kolegy 2', 'Colleague email 2', "E-Mail von Mitarbeiter 2", "Почта сотрудника 2"], ['E-mail kolegy 3', 'Colleague email 3', "E-Mail von Mitarbeiter 3", "Почта сотрудника 3"],
        ['Firemní přístupy byly uloženy.', 'Company seats saved.', "Firmenzugänge gespeichert.", "Доступы сотрудников сохранены."],
        ['Zadejte různé e-maily kolegů.', 'Enter distinct colleague email addresses.', "Geben Sie unterschiedliche E-Mail-Adressen ein.", "Укажите разные адреса сотрудников."],
        ['Některý e-mail už patří k jiné firmě.', 'An email is already linked to another company.', "Eine E-Mail-Adresse ist bereits einer anderen Firma zugeordnet.", "Один из адресов уже привязан к другой компании."],
        ['Firemní přístupy se nepodařilo uložit.', 'Unable to save company seats.', "Firmenzugänge konnten nicht gespeichert werden.", "Не удалось сохранить доступы сотрудников."],
        ['Najít detektor', 'Find a detector', "Melder suchen", "Найти датчик"], ['Sběrnice', 'Bus', "Bus", "Шина"], ['Číslo detektoru', 'Detector number', "Meldernummer", "Номер датчика"],
        ['Najít', 'Find', "Suchen", "Найти"], ['Detektor s adresou {0} nebyl nalezen.', 'No detector matches address {0}.', "Kein Melder mit der Adresse {0} gefunden.", "Датчик с адресом {0} не найден."],
        ['Vyberte detektor s adresou {0}.', 'Choose a detector with address {0}.', "Wählen Sie einen Melder mit der Adresse {0}.", "Выберите датчик с адресом {0}."],
        ['Скрыть зоны PIR', 'Skrýt zóny PIR', 'Hide PIR coverage', "PIR-Erfassungsbereiche ausblenden", "Скрыть зоны PIR"], ['Показать зоны PIR', 'Zobrazit zóny PIR', 'Show PIR coverage', "PIR-Erfassungsbereiche einblenden", "Показать зоны PIR"],
        ['Выключить сетку', 'Vypnout mřížku', 'Hide grid', "Raster ausblenden", "Выключить сетку"], ['Включить сетку', 'Zapnout mřížku', 'Show grid', "Raster einblenden", "Включить сетку"],
        ['Укажите порог яркости от 0 до 255 и радиус PIR от 10 до 2000 пикселей.', 'Zadejte práh jasu 0–255 a dosah PIR 10–2000 pixelů.', 'Enter a brightness threshold of 0–255 and a PIR range of 10–2000 pixels.', "Geben Sie einen Helligkeitsgrenzwert von 0–255 und eine PIR-Reichweite von 10–2000 Pixeln ein.", "Укажите порог яркости от 0 до 255 и дальность PIR от 10 до 2000 пикселей."],
        ['Некорректные настройки', 'Neplatné nastavení', 'Invalid settings', "Ungültige Einstellungen", "Неверные настройки"], ['Не удалось распознать стены: {0}', 'Stěny se nepodařilo rozpoznat: {0}', 'Could not detect walls: {0}', "Wände konnten nicht erkannt werden: {0}", "Не удалось распознать стены: {0}"],
        ['Ошибка распознавания стен', 'Chyba rozpoznání stěn', 'Wall detection error', "Fehler bei der Wanderkennung", "Ошибка распознавания стен"], ['Nový projekt', 'New project', "Neues Projekt", "Новый проект"],
        ['Opravdu chcete začít nový projekt? Neuložené změny budou ztraceny.', 'Start a new project? Unsaved changes will be lost.', "Neues Projekt starten? Ungespeicherte Änderungen gehen verloren.", "Начать новый проект? Несохранённые изменения будут потеряны."],
        ['Žádná data k tisku.', 'There is nothing to print.', "Es gibt nichts zu drucken.", "Нет данных для печати."], ['Печать', 'Tisk', 'Print', "Drucken", "Печать"], ['Чертёж: {0}', 'Výkres: {0}', 'Drawing: {0}', "Plan: {0}", "Чертёж: {0}"],
        ['Не удалось подготовить чертёж к печати.', 'Výkres se nepodařilo připravit k tisku.', 'Could not prepare the drawing for printing.', "Der Plan konnte nicht für den Druck vorbereitet werden.", "Не удалось подготовить чертёж к печати."],
        ['Ошибка печати', 'Chyba tisku', 'Printing error', "Druckfehler", "Ошибка печати"], ['Не удалось подготовить чертёж к печати: {0}', 'Výkres se nepodařilo připravit k tisku: {0}', 'Could not prepare the drawing for printing: {0}', "Der Plan konnte nicht für den Druck vorbereitet werden: {0}", "Не удалось подготовить чертёж к печати: {0}"],
        ['Projekt neobsahuje žádné podlaží k tisku.', 'The project has no floors to print.', "Das Projekt enthält keine druckbaren Geschosse.", "В проекте нет этажей для печати."],
        ['Poznámka', 'Note', "Notiz", "Заметка"], ['Bezdrátový PIR', 'Wireless PIR', "Funk-PIR-Melder", "Беспроводной PIR-датчик"], ['Magnetický kontakt', 'Magnetic contact', "Magnetkontakt", "Магнитный контакт"], ['Bezdrátový Magnet', 'Wireless magnetic contact', "Funk-Magnetkontakt", "Беспроводной магнитный контакт"],
        ['Tříštění skla', 'Glass break', "Glasbruch", "Разбитие стекла"], ['Tísňové tlačítko', 'Panic button', "Überfalltaster", "Тревожная кнопка"], ['Siréna', 'Siren', "Sirene", "Сирена"], ['Ústředna EZS', 'Alarm control panel', "Einbruchmeldezentrale", "Охранная централь"],
        ['Expandér (EXP)', 'Expander (EXP)', "Erweiterungsmodul (EXP)", "Расширитель (EXP)"], ['Klávesnice', 'Keypad', "Bedienteil", "Клавиатура"], ['Deaktivováno', 'Disabled', "Deaktiviert", "Отключён"], ['Textová poznámka', 'Text note', "Textnotiz", "Текстовая заметка"],
        ['Tajný Ramen', 'Secret ramen', "Geheimes Ramen", "Секретный рамен"], ['Nástroj kabelu', 'Cable tool', "Kabelwerkzeug", "Инструмент прокладки кабеля"], [' (Ručně)', ' (Manual)', " (Manuell)", " (Вручную)"], ['Sběrnice: {0}', 'Bus: {0}', "Bus: {0}", "Шина: {0}"],
        ['Ошибка открытия проекта', 'Chyba otevření projektu', 'Project opening error', "Fehler beim Öffnen des Projekts", "Ошибка открытия проекта"],
        ['Локальное сохранение недоступно. Создайте или откройте другой проект.', 'Místní záloha není dostupná. Vytvořte nebo otevřete jiný projekt.', 'The local save is unavailable. Create or open another project.', "Die lokale Sicherung ist nicht verfügbar. Erstellen oder öffnen Sie ein anderes Projekt.", "Локальное сохранение недоступно. Создайте или откройте другой проект."],
        ['Не удалось продолжить проект', 'Projekt nelze obnovit', 'Could not resume the project', "Projekt konnte nicht wiederhergestellt werden", "Не удалось восстановить проект"],
        ['Изображение загружено, но стены распознать не удалось: {0}', 'Obrázek je načten, ale stěny se nepodařilo rozpoznat: {0}', 'The image loaded, but wall detection failed: {0}', "Bild geladen, Wände konnten jedoch nicht erkannt werden: {0}", "Изображение загружено, но стены распознать не удалось: {0}"],
        ['План загружен с предупреждением', 'Výkres načten s upozorněním', 'Drawing loaded with a warning', "Plan mit Warnung geladen", "Чертёж загружен с предупреждением"], ['Chyba při načítání PDF.', 'Could not load the PDF.', "PDF konnte nicht geladen werden.", "Не удалось загрузить PDF."],
        ['Ошибка загрузки PDF', 'Chyba načítání PDF', 'PDF loading error', "Fehler beim Laden der PDF-Datei", "Ошибка загрузки PDF"], ['Chyba při zpracování DXF souboru.', 'Could not process the DXF file.', "DXF-Datei konnte nicht verarbeitet werden.", "Не удалось обработать файл DXF."],
        ['Ошибка загрузки DXF', 'Chyba načítání DXF', 'DXF loading error', "Fehler beim Laden der DXF-Datei", "Ошибка загрузки DXF"], ['Soubor je prázdný.', 'The file is empty.', "Die Datei ist leer.", "Файл пуст."], ['Neznámá struktura dat v souboru.', 'Unknown file data structure.', "Unbekannte Datenstruktur in der Datei.", "Неизвестная структура данных в файле."],
        ['Obnovený projekt', 'Recovered project', "Wiederhergestelltes Projekt", "Восстановленный проект"], ['Chyba při načítání souboru .TECH!\n\nDetail chyby: ', 'Could not load the .TECH file.\n\nError details: ', "Die .TECH-Datei konnte nicht geladen werden.\n\nFehlerdetails: ", "Не удалось загрузить файл .TECH.\n\nПодробности ошибки: "],
        ['Не удалось прочитать файл проекта.', 'Soubor projektu nelze přečíst.', 'Could not read the project file.', "Die Projektdatei konnte nicht gelesen werden.", "Не удалось прочитать файл проекта."], ['Bez názvu', 'Untitled', "Unbenannt", "Без названия"],
        ['Проверяем вход…', 'Ověřování přihlášení…', 'Checking sign-in…', "Anmeldung wird geprüft…", "Проверяем вход…"], ['Вы вошли как {0}', 'Přihlášený uživatel: {0}', 'Signed in as {0}', "Angemeldet als {0}", "Вы вошли как {0}"], ['Google-пользователь', 'Uživatel', 'User', "Benutzer", "Пользователь"],
        ['Проверка входа заняла слишком много времени. Проверьте интернет и попробуйте снова.', 'Ověření přihlášení trvá příliš dlouho. Zkontrolujte připojení a zkuste to znovu.', 'Sign-in verification timed out. Check your connection and try again.', "Die Anmeldeprüfung dauerte zu lange. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.", "Проверка входа заняла слишком много времени. Проверьте подключение и попробуйте ещё раз."],
        ['Проверяем сохранённую сессию…', 'Ověřování uloženého přihlášení…', 'Checking the saved session…', "Gespeicherte Sitzung wird geprüft…", "Проверяем сохранённую сессию…"],
        ['Сессия истекла. Войдите в аккаунт снова.', 'Platnost přihlášení vypršela. Přihlaste se znovu.', 'Your session expired. Sign in again.', "Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.", "Сессия истекла. Войдите снова."],
        ['Не удалось проверить вход. Проверьте подключение и войдите снова.', 'Přihlášení nelze ověřit. Zkontrolujte připojení a přihlaste se znovu.', 'Could not verify sign-in. Check your connection and sign in again.', "Anmeldung konnte nicht geprüft werden. Prüfen Sie die Verbindung und melden Sie sich erneut an.", "Не удалось проверить вход. Проверьте подключение и войдите снова."],
        ['Не удалось загрузить сервис входа. Проверьте подключение и попробуйте снова.', 'Přihlašovací službu nelze načíst. Zkontrolujte připojení a zkuste to znovu.', 'Could not load the sign-in service. Check your connection and try again.', "Anmeldedienst konnte nicht geladen werden. Prüfen Sie die Verbindung und versuchen Sie es erneut.", "Не удалось загрузить сервис входа. Проверьте подключение и попробуйте ещё раз."],
        ['Сначала заполните веб-конфигурацию Firebase в config.js.', 'Doplňte konfiguraci Firebase v souboru config.js.', 'Complete the Firebase configuration in config.js.', "Vervollständigen Sie die Firebase-Konfiguration in config.js.", "Заполните конфигурацию Firebase в config.js."],
        ['Вход выполняется...', 'Přihlašování…', 'Signing in…', "Anmeldung läuft…", "Выполняется вход…"],
        ['Google-вход доступен только на сайте с HTTPS или localhost. Откройте GOOM по адресу https://pzts.five.surf/.', 'Přihlášení je dostupné pouze přes HTTPS nebo localhost. Otevřete https://pzts.five.surf/.', 'Sign-in requires HTTPS or localhost. Open https://pzts.five.surf/.', "Die Anmeldung erfordert HTTPS oder localhost. Öffnen Sie https://pzts.five.surf/.", "Для входа нужен HTTPS или localhost. Откройте https://pzts.five.surf/."],
        ['Добавьте домен сайта в список разрешённых доменов Firebase Authentication.', 'Přidejte doménu webu mezi povolené domény Firebase Authentication.', 'Add the website domain to Firebase Authentication authorized domains.', "Fügen Sie die Website-Domain in Firebase Authentication zu den autorisierten Domains hinzu.", "Добавьте домен сайта в список разрешённых в Firebase Authentication."],
        ['Включите провайдер Google в настройках Firebase Authentication.', 'Povolte poskytovatele Google ve Firebase Authentication.', 'Enable the Google provider in Firebase Authentication.', "Aktivieren Sie Google als Anbieter in Firebase Authentication.", "Включите вход через Google в Firebase Authentication."],
        ['Не удалось войти через Google', 'Přihlášení přes Google se nezdařilo', 'Google sign-in failed', "Google-Anmeldung fehlgeschlagen", "Не удалось войти через Google"], ['Подключаем сервис входа…', 'Připojování přihlašovací služby…', 'Connecting to the sign-in service…', "Verbindung zum Anmeldedienst wird hergestellt…", "Подключаемся к сервису входа…"],
        ['Не удалось выйти из аккаунта', 'Odhlášení se nezdařilo', 'Sign-out failed', "Abmeldung fehlgeschlagen", "Не удалось выйти из аккаунта"], ['Модуль Firebase не загружен.', 'Modul Firebase není načten.', 'The Firebase module is not loaded.', "Das Firebase-Modul ist nicht geladen.", "Модуль Firebase не загружен."],
        ['Войдите через Google для синхронизации', 'Přihlaste se pro synchronizaci', 'Sign in to sync', "Zur Synchronisierung anmelden", "Войдите для синхронизации"], ['Сначала войдите через Google.', 'Nejprve se přihlaste.', 'Sign in first.', "Melden Sie sich zuerst an.", "Сначала войдите в аккаунт."],
        ['Облачные проекты', 'Cloudové projekty', 'Cloud projects', "Cloud-Projekte", "Облачные проекты"], ['Дождитесь загрузки проекта и повторите попытку.', 'Počkejte na načtení projektu a zkuste to znovu.', 'Wait for the project to load and try again.', "Warten Sie, bis das Projekt geladen ist, und versuchen Sie es erneut.", "Дождитесь загрузки проекта и попробуйте ещё раз."],
        ['Введите название для сохранения в облаке:', 'Zadejte název projektu pro uložení do cloudu:', 'Enter a project name to save to the cloud:', "Geben Sie einen Projektnamen für die Cloud-Speicherung ein:", "Введите название проекта для сохранения в облаке:"], ['Сохранить проект', 'Uložit projekt', 'Save project', "Projekt speichern", "Сохранить проект"],
        ['Синхронизация…', 'Synchronizace…', 'Syncing…', "Synchronisierung läuft…", "Синхронизация…"], ['Без названия', 'Bez názvu', 'Untitled', "Unbenannt", "Без названия"],
        ['Не удалось создать копию конфликта. Повторите сохранение.', 'Konfliktní kopii nelze vytvořit. Zkuste uložit projekt znovu.', 'Could not create a conflict copy. Try saving again.', "Konfliktkopie konnte nicht erstellt werden. Speichern Sie erneut.", "Не удалось создать копию при конфликте. Попробуйте сохранить ещё раз."],
        ['{0} (копия)', '{0} (kopie)', '{0} (copy)', "{0} (Kopie)", "{0} (копия)"], ['Проект сохранён, но старая версия не удалена', 'Projekt je uložen, ale starou verzi nelze odstranit', 'Project saved; the previous version could not be removed', "Projekt gespeichert. Die vorige Version konnte nicht entfernt werden.", "Проект сохранён. Не удалось удалить предыдущую версию."],
        ['Изменения разошлись: сохранена отдельная копия', 'Změny jsou v konfliktu: byla uložena samostatná kopie', 'Conflicting changes: a separate copy was saved', "Änderungskonflikt: Eine separate Kopie wurde gespeichert", "Конфликт изменений. Сохранена отдельная копия"],
        ['Облако: сохранено', 'Uloženo v cloudu', 'Saved to cloud', "In der Cloud gespeichert", "Сохранено в облаке"], ['Ошибка облака: {0}', 'Chyba cloudu: {0}', 'Cloud error: {0}', "Cloud-Fehler: {0}", "Ошибка облака: {0}"],
        ['Не удалось сохранить проект в облако', 'Projekt nelze uložit do cloudu', 'Could not save the project to the cloud', "Projekt konnte nicht in der Cloud gespeichert werden", "Не удалось сохранить проект в облаке"],
        ['Uložit do cloudu', 'Uložit do cloudu', 'Save to cloud', "In der Cloud speichern", "Сохранить в облаке"],
        ['Uložit kopii do cloudu', 'Uložit kopii do cloudu', 'Save a copy to cloud', "Kopie in der Cloud speichern", "Сохранить копию в облаке"],
        ['V cloudu je už 5 projektů. Nejdříve některý odstraňte.', 'V cloudu je už 5 projektů. Nejdříve některý odstraňte.', 'There are already 5 cloud projects. Delete one first.', "In der Cloud liegen bereits fünf Projekte. Löschen Sie zuerst eines.", "В облаке уже пять проектов. Сначала удалите один из них."],
        ['Soubor tohoto projektu v cloudu chybí.', 'Soubor tohoto projektu v cloudu chybí.', 'This project file is missing from cloud storage.', "Diese Projektdatei fehlt im Cloud-Speicher.", "Файл проекта отсутствует в облаке."],
        ['Firebase Storage nepovolil otevření tohoto projektu.', 'Firebase Storage nepovolil otevření tohoto projektu.', 'Firebase Storage denied access to this project.', "Firebase Storage hat den Zugriff auf dieses Projekt verweigert.", "Firebase Storage отказал в доступе к проекту."],
        ['Cloudový soubor se nepodařilo stáhnout. Zkontrolujte připojení a zkuste to znovu.', 'Cloudový soubor se nepodařilo stáhnout. Zkontrolujte připojení a zkuste to znovu.', 'Could not download the cloud file. Check your connection and try again.', "Cloud-Datei konnte nicht heruntergeladen werden. Prüfen Sie die Verbindung und versuchen Sie es erneut.", "Не удалось скачать файл из облака. Проверьте подключение и попробуйте ещё раз."],
        ['Otevřeno', 'Otevřeno', 'Open now', "Jetzt öffnen", "Открыть сейчас"], ['Ukládání kopie…', 'Ukládání kopie…', 'Saving copy…', "Kopie wird gespeichert…", "Сохраняем копию…"], ['Odstraňování projektu…', 'Odstraňování projektu…', 'Deleting project…', "Projekt wird gelöscht…", "Удаляем проект…"],
        ['Projekt byl odstraněn z cloudu.', 'Projekt byl odstraněn z cloudu.', 'Project deleted from cloud.', "Projekt aus der Cloud gelöscht.", "Проект удалён из облака."],
        ['Firebase Storage nepovolil uložení projektu. Obraťte se na správce.', 'Firebase Storage nepovolil uložení projektu. Obraťte se na správce.', 'Firebase Storage denied the upload. Contact your administrator.', "Firebase Storage hat das Hochladen verweigert. Wenden Sie sich an den Administrator.", "Firebase Storage отказал в загрузке. Обратитесь к администратору."],
        ['Не удалось очистить незавершённую загрузку', 'Nedokončené nahrávání nelze odstranit', 'Could not remove the incomplete upload', "Unvollständiger Upload konnte nicht entfernt werden", "Не удалось удалить незавершённую загрузку"],
        ['Загружаю список проектов…', 'Načítání seznamu projektů…', 'Loading projects…', "Projekte werden geladen…", "Загружаем проекты…"], ['В облаке пока нет проектов.', 'V cloudu zatím nejsou žádné projekty.', 'There are no cloud projects yet.', "Es gibt noch keine Cloud-Projekte.", "В облаке пока нет проектов."],
        ['Изменён: {0}', 'Změněno: {0}', 'Updated: {0}', "Geändert: {0}", "Изменено: {0}"], ['Дата изменения неизвестна', 'Datum změny není dostupné', 'Update date unavailable', "Änderungsdatum nicht verfügbar", "Дата изменения недоступна"],
        ['Открыть', 'Otevřít', 'Open', "Öffnen", "Открыть"], ['Удалить', 'Odstranit', 'Delete', "Löschen", "Удалить"], ['Проектов в облаке: {0}', 'Projektů v cloudu: {0}', 'Cloud projects: {0}', "Cloud-Projekte: {0}", "Облачные проекты: {0}"],
        ['Ошибка списка: {0}', 'Chyba seznamu: {0}', 'Project list error: {0}', "Fehler beim Laden der Projektliste: {0}", "Ошибка загрузки списка проектов: {0}"], ['Открыть «{0}»? Текущий проект будет заменён.', 'Otevřít „{0}“? Aktuální projekt bude nahrazen.', 'Open “{0}”? The current project will be replaced.', "„{0}“ öffnen? Das aktuelle Projekt wird ersetzt.", "Открыть «{0}»? Текущий проект будет заменён."],
        ['Открыть облачный проект', 'Otevřít cloudový projekt', 'Open cloud project', "Cloud-Projekt öffnen", "Открыть облачный проект"], ['Загружаю проект…', 'Načítání projektu…', 'Loading project…', "Projekt wird geladen…", "Загрузка проекта…"],
        ['Не удалось загрузить файл проекта из Firebase Storage.', 'Soubor projektu nelze stáhnout z Firebase Storage.', 'Could not download the project from Firebase Storage.', "Projekt konnte nicht aus Firebase Storage heruntergeladen werden.", "Не удалось скачать проект из Firebase Storage."],
        ['Не удалось открыть данные проекта', 'Data projektu nelze otevřít', 'Could not open the project data', "Projektdaten konnten nicht geöffnet werden", "Не удалось открыть данные проекта"], ['Облачный проект открыт', 'Cloudový projekt je otevřen', 'Cloud project opened', "Cloud-Projekt geöffnet", "Облачный проект открыт"],
        ['Ошибка открытия: {0}', 'Chyba otevření: {0}', 'Opening error: {0}', "Fehler beim Öffnen: {0}", "Ошибка открытия: {0}"], ['Не удалось открыть облачный проект', 'Cloudový projekt nelze otevřít', 'Could not open the cloud project', "Cloud-Projekt konnte nicht geöffnet werden", "Не удалось открыть облачный проект"],
        ['Удалить «{0}» из облака?', 'Odstranit „{0}“ z cloudu?', 'Delete “{0}” from the cloud?', "„{0}“ aus der Cloud löschen?", "Удалить «{0}» из облака?"], ['Удалить проект', 'Odstranit projekt', 'Delete project', "Projekt löschen", "Удалить проект"],
        ['Ошибка удаления: {0}', 'Chyba odstranění: {0}', 'Deletion error: {0}', "Fehler beim Löschen: {0}", "Ошибка удаления: {0}"], ['Не удалось удалить облачный проект', 'Cloudový projekt nelze odstranit', 'Could not delete the cloud project', "Cloud-Projekt konnte nicht gelöscht werden", "Не удалось удалить облачный проект"],
        ['Войдите через Google, чтобы открыть облачные проекты.', 'Pro otevření cloudových projektů se přihlaste.', 'Sign in to open cloud projects.', "Melden Sie sich an, um Cloud-Projekte zu öffnen.", "Войдите, чтобы открыть облачные проекты."],
        ['Аккаунт: {0}', 'Účet: {0}', 'Account: {0}', "Konto: {0}", "Аккаунт: {0}"], ['подключён', 'připojeno', 'connected', "verbunden", "подключено"], ['Firebase недоступен: {0}', 'Firebase není dostupný: {0}', 'Firebase unavailable: {0}', "Firebase nicht verfügbar: {0}", "Firebase недоступен: {0}"],
        ['Настройте Firebase для синхронизации', 'Nastavte Firebase pro synchronizaci', 'Configure Firebase to sync', "Firebase für die Synchronisierung einrichten", "Настроить Firebase для синхронизации"],
        ['Понятно', 'Rozumím', 'OK', "OK", "ОК"], ['Сохранить', 'Uložit', 'Save', "Speichern", "Сохранить"], ['Подтвердить', 'Potvrdit', 'Confirm', "Bestätigen", "Подтвердить"], ['Сообщение', 'Zpráva', 'Message', "Meldung", "Сообщение"],
        ['Подтвердите действие', 'Potvrďte akci', 'Confirm action', "Aktion bestätigen", "Подтвердить действие"], ['Введите значение', 'Zadejte hodnotu', 'Enter a value', "Wert eingeben", "Введите значение"],
        ['Ошибка локального сохранения', 'Chyba místního ukládání', 'Local save error', "Fehler beim lokalen Speichern", "Ошибка локального сохранения"], ['Не удалось прочитать локальное сохранение.', 'Místní zálohu nelze přečíst.', 'Could not read the local save.', "Die lokale Sicherung konnte nicht gelesen werden.", "Не удалось прочитать локальную копию."],
        ['Žádná data k exportu.', 'There is nothing to export.', "Es gibt nichts zu exportieren.", "Нет данных для экспорта."], ['Экспорт проекта', 'Export projektu', 'Export project', "Projekt exportieren", "Экспорт проекта"], ['Chyba při generování exportu.', 'Could not generate the export.', "Export konnte nicht erstellt werden.", "Не удалось подготовить экспорт."],
        ['Ошибка экспорта', 'Chyba exportu', 'Export error', "Exportfehler", "Ошибка экспорта"], ['Не удалось создать маску стен для чертежа.', 'Masku stěn výkresu nelze vytvořit.', 'Could not create the drawing wall mask.', "Die Wandmaske des Plans konnte nicht erstellt werden.", "Не удалось создать маску стен чертежа."],
        ['Načítání projektu...', 'Loading project…', "Projekt wird geladen…", "Загрузка проекта…"], ['Terén', 'Ground', "Gelände", "Уровень земли"],
        ['Откройте меню GOOM', 'Otevřete nabídku GOOM', 'Open the GOOM menu', "GOOM-Menü öffnen", "Откройте меню GOOM"], ['Чтобы загрузить план этажа, нажмите на значок GOOM в верхней панели.', 'Výkres podlaží nahrajete pomocí ikony GOOM v horní liště.', 'To upload a floor plan, select the GOOM icon in the top toolbar.', "Wählen Sie das GOOM-Symbol in der oberen Leiste, um einen Grundriss hochzuladen.", "Чтобы загрузить план этажа, нажмите значок GOOM в верхней панели."],
        ['Загрузите план', 'Nahrajte výkres', 'Upload a plan', "Plan hochladen", "Загрузите план"], ['Выберите изображение или PDF с планом. После загрузки можно будет размещать на нём датчики.', 'Vyberte obrázek nebo PDF výkresu. Po načtení můžete rozmístit detektory.', 'Choose an image or PDF plan. You can place detectors once it has loaded.', "Wählen Sie einen Plan als Bild oder PDF. Nach dem Laden können Sie darauf Melder platzieren.", "Выберите изображение или PDF с планом. После загрузки можно расставлять датчики."],
        ['Выберите датчик', 'Vyberte detektor', 'Choose a detector', "Melder auswählen", "Выберите датчик"], ['Разверните панель инструментов, выберите датчик, затем щёлкните по плану, чтобы его поставить.', 'Rozbalte panel nástrojů, vyberte detektor a umístěte jej kliknutím nebo klepnutím do výkresu.', 'Expand the toolbar, choose a detector, then click or tap the plan to place it.', "Klappen Sie die Werkzeugleiste aus, wählen Sie einen Melder und klicken oder tippen Sie auf den Plan.", "Разверните панель, выберите датчик и нажмите на план, чтобы его разместить."],
        ['Работайте с планом', 'Pracujte s výkresem', 'Work with the plan', "Mit dem Plan arbeiten", "Работайте с планом"], ['Перетаскивайте датчики мышью. Чтобы выделить несколько, зажмите левую кнопку и протяните рамку.', 'Detektory přesouvejte tažením. Více prvků označíte výběrovým rámečkem. Na tabletu použijte dva prsty pro posun a přiblížení.', 'Drag detectors to move them. Drag a selection box to select several. On a tablet, use two fingers to pan and zoom.', "Ziehen Sie Melder zum Verschieben. Ziehen Sie einen Rahmen, um mehrere auszuwählen. Auf dem Tablet verschieben und zoomen Sie mit zwei Fingern.", "Перетаскивайте датчики для перемещения. Чтобы выделить несколько, протяните рамку. На планшете перемещайте и масштабируйте план двумя пальцами."],
        ['Шаг {0} из {1}', 'Krok {0} z {1}', 'Step {0} of {1}', "Schritt {0} von {1}", "Шаг {0} из {1}"], ['Готово', 'Hotovo', 'Done', "Fertig", "Готово"], ['Далее', 'Dále', 'Next', "Weiter", "Далее"],
        ['Управляющая панель', 'Ústředna', 'Control panel', "Zentrale", "Централь"], ['Расширитель', 'Expandér', 'Expander', "Erweiterungsmodul", "Расширитель"], ['Беспроводной модуль', 'Bezdrátový modul', 'Wireless module', "Funkmodul", "Беспроводной модуль"],
        ['Клавиатура', 'Klávesnice', 'Keypad', "Bedienteil", "Клавиатура"], ['PIR датчик', 'PIR detektor', 'PIR detector', "PIR-Melder", "PIR-датчик"], ['Беспроводной PIR', 'Bezdrátový PIR', 'Wireless PIR', "Funk-PIR-Melder", "Беспроводной PIR-датчик"],
        ['Магнитный контакт', 'Magnetický kontakt', 'Magnetic contact', "Magnetkontakt", "Магнитный контакт"], ['Беспроводной контакт', 'Bezdrátový kontakt', 'Wireless contact', "Funkkontakt", "Беспроводной контакт"], ['Датчик разбития стекла', 'Detektor tříštění skla', 'Glass-break detector', "Glasbruchmelder", "Датчик разбития стекла"],
        ['Тревожная кнопка', 'Tísňové tlačítko', 'Panic button', "Überfalltaster", "Тревожная кнопка"], ['Сирена', 'Siréna', 'Siren', "Sirene", "Сирена"], ['Цвет {0}', 'Barva {0}', 'Color {0}', "Farbe {0}", "Цвет {0}"],
        ['Не удалось загрузить созданный значок устройства: {0}', 'Vlastní ikonu zařízení nelze načíst: {0}', 'Could not load the custom device icon: {0}', "Benutzerdefiniertes Meldersymbol konnte nicht geladen werden: {0}", "Не удалось загрузить пользовательский значок датчика: {0}"],
        ['Выберите фигуру или добавьте новую.', 'Vyberte tvar nebo přidejte nový.', 'Select a shape or add a new one.', "Wählen Sie eine Form oder fügen Sie eine hinzu.", "Выберите фигуру или добавьте новую."],
        ['Выбрана фигура {0} из {1}. Перетаскивайте её мышью.', 'Vybraný tvar {0} z {1}. Přesuňte jej tažením.', 'Shape {0} of {1} selected. Drag to move it.', "Form {0} von {1} gewählt. Zum Verschieben ziehen.", "Выбрана фигура {0} из {1}. Перетащите её для перемещения."],
        ['Текст фигуры', 'Text tvaru', 'Shape text', "Formtext", "Текст фигуры"], ['Центральный блок', 'Ústředna', 'Control panel', "Zentrale", "Централь"], ['PIR-датчик', 'PIR detektor', 'PIR detector', "PIR-Melder", "PIR-датчик"],
        ['Текстовая заметка', 'Textová poznámka', 'Text note', "Textnotiz", "Текстовая заметка"], ['Основное меню', 'Hlavní nabídka', 'Main menu', "Hauptmenü", "Основное меню"], ['Меню {0}', 'Nabídka {0}', 'Menu {0}', "Menü {0}", "Меню {0}"],
        ['Vytvořte kopii sady pro úpravy.', 'Vytvořte kopii sady pro úpravy.', 'Create a copy of this set to edit it.', "Erstellen Sie eine Kopie dieses Satzes, um ihn zu bearbeiten.", "Скопируйте этот набор, чтобы его редактировать."],
        ['Barva výplně', 'Barva výplně', 'Fill color', "Füllfarbe", "Цвет заливки"],
        ['Tloušťka textu', 'Tloušťka textu', 'Font weight', "Schriftstärke", "Толщина шрифта"],
        ['Použít ikonu jako šablonu', 'Použít ikonu jako šablonu', 'Use an icon as a template', "Symbol als Vorlage verwenden", "Использовать значок как шаблон"],
        ['Použít šablonu', 'Použít šablonu', 'Apply template', "Vorlage anwenden", "Применить шаблон"],
        ['Nahradit ikonu šablonou?', 'Nahradit ikonu šablonou?', 'Replace the icon with the template?', "Das Symbol durch die Vorlage ersetzen?", "Заменить значок шаблоном?"],
        ['Šablona', 'Template', "Vorlage", "Шаблон"], ['Uložit šablonu', 'Save template', "Vorlage speichern", "Сохранить шаблон"], ['Přepsat šablonu', 'Replace template', "Vorlage ersetzen", "Перезаписать шаблон"],
        ['Šablonu nelze uložit v tomto prohlížeči.', 'Could not save the template in this browser.', "Vorlage konnte in diesem Browser nicht gespeichert werden.", "Не удалось сохранить шаблон в этом браузере."],
        ['Posunout tvary nahoru', 'Scroll shapes up', "Formen nach oben scrollen", "Прокрутить фигуры вверх"], ['Posunout tvary dolů', 'Scroll shapes down', "Formen nach unten scrollen", "Прокрутить фигуры вниз"],
        ['Obdélník', 'Rectangle', "Rechteck", "Прямоугольник"], ['Zaoblený obdélník', 'Rounded rectangle', "Abgerundetes Rechteck", "Скруглённый прямоугольник"], ['Ovál', 'Oval', "Oval", "Овал"],
        ['Kapsle', 'Capsule', "Kapsel", "Капсула"], ['Osmiúhelník', 'Octagon', "Achteck", "Восьмиугольник"],
        ['Duplikovat tvar', 'Duplikovat tvar', 'Duplicate shape', "Form duplizieren", "Дублировать фигуру"],
        ['Otočit doleva', 'Otočit doleva', 'Rotate left', "Nach links drehen", "Повернуть влево"],
        ['Otočit doprava', 'Otočit doprava', 'Rotate right', "Nach rechts drehen", "Повернуть вправо"],
        ['Elipsa', 'Elipsa', 'Ellipse', "Ellipse", "Эллипс"], ['Šestiúhelník', 'Šestiúhelník', 'Hexagon', "Sechseck", "Шестиугольник"],
        ['Oblouk', 'Oblouk', 'Arc', "Bogen", "Дуга"], ['Šipka', 'Šipka', 'Arrow', "Pfeil", "Стрелка"],
        ['Не удалось сохранить наборы меню в этом браузере.', 'Sady nabídek nelze v tomto prohlížeči uložit.', 'Could not save menu sets in this browser.', "Menüsätze konnten in diesem Browser nicht gespeichert werden.", "Не удалось сохранить наборы меню в этом браузере."], ['Ошибка сохранения', 'Chyba ukládání', 'Save error', "Speicherfehler", "Ошибка сохранения"],
        ['Текущий набор: {0}. Нажмите, чтобы переключить', 'Aktuální sada: {0}. Kliknutím přepnete', 'Current set: {0}. Click to switch', "Aktueller Satz: {0}. Zum Wechseln klicken", "Текущий набор: {0}. Нажмите, чтобы переключить"],
        ['Текущий набор меню: {0}. Переключить набор', 'Aktuální sada nabídek: {0}. Přepnout sadu', 'Current menu set: {0}. Switch set', "Aktueller Menüsatz: {0}. Satz wechseln", "Текущий набор меню: {0}. Переключить набор"], ['Выбранное меню', 'Vybraná nabídka', 'Selected menu', "Ausgewähltes Menü", "Выбранное меню"],
        ['Название меню: {0}', 'Název nabídky: {0}', 'Menu name: {0}', "Menüname: {0}", "Название меню: {0}"], ['Выбрать значок: {0}', 'Vybrat ikonu: {0}', 'Select icon: {0}', "Symbol auswählen: {0}", "Выбрать значок: {0}"],
        ['Удалить меню «{0}»', 'Odstranit nabídku „{0}“', 'Delete menu “{0}”', "Menü „{0}“ löschen", "Удалить меню «{0}»"], ['Можно создать не более 7 меню', 'Lze vytvořit nejvýše 7 nabídek', 'You can create up to 7 menus', "Sie können bis zu sieben Menüs erstellen", "Можно создать до семи меню"],
        ['Добавить меню', 'Přidat nabídku', 'Add menu', "Menü hinzufügen", "Добавить меню"], ['Есть несохранённые изменения', 'Máte neuložené změny', 'You have unsaved changes', "Sie haben ungespeicherte Änderungen", "Есть несохранённые изменения"],
        ['Этот набор используется на панели', 'Tato sada se používá v panelu', 'This set is used in the toolbar', "Dieser Satz wird in der Werkzeugleiste verwendet", "Этот набор используется на панели"], ['Выберите набор, измените его и сохраните', 'Vyberte sadu, upravte ji a uložte', 'Choose a set, edit it, and save', "Satz auswählen, bearbeiten und speichern", "Выберите набор, отредактируйте и сохраните"],
        ['Сохранить меню', 'Uložit nabídku', 'Save menu', "Menü speichern", "Сохранить меню"], ['Сохранено', 'Uloženo', 'Saved', "Gespeichert", "Сохранено"], ['Отбросить несохранённые изменения?', 'Zahodit neuložené změny?', 'Discard unsaved changes?', "Ungespeicherte Änderungen verwerfen?", "Отменить несохранённые изменения?"],
        ['Publikovat pro PROJECT', 'Publikovat pro PROJECT', 'Publish for PROJECT', 'Für PROJECT veröffentlichen', 'Опубликовать для PROJECT'],
        ['Сначала сохраните меню', 'Nejprve uložte nabídku', 'Save the menu first', 'Menü zuerst speichern', 'Сначала сохраните меню'],
        ['Опубликовано для PROJECT', 'Publikováno pro PROJECT', 'Published for PROJECT', 'Für PROJECT veröffentlicht', 'Опубликовано для PROJECT'],
        ['Снять с публикации', 'Zrušit publikaci', 'Unpublish', 'Veröffentlichung zurücknehmen', 'Снять с публикации'],
        ['Снять меню «{0}» с публикации?', 'Zrušit publikaci nabídky „{0}“?', 'Unpublish the “{0}” menu?', 'Veröffentlichung des Menüs „{0}“ zurücknehmen?', 'Снять меню «{0}» с публикации?'],
        ['Не удалось обновить набор PROJECT. Проверьте подключение и правила Firebase.', 'Sadu PROJECT nelze aktualizovat. Zkontrolujte připojení a pravidla Firebase.', 'Could not update the PROJECT set. Check your connection and Firebase rules.', 'Die PROJECT-Vorlage konnte nicht aktualisiert werden. Prüfen Sie die Verbindung und die Firebase-Regeln.', 'Не удалось обновить набор PROJECT. Проверьте подключение и правила Firebase.'],
        ['Закрыть редактор меню без сохранения изменений?', 'Zavřít editor nabídek bez uložení změn?', 'Close the menu editor without saving?', "Menüeditor ohne Speichern schließen?", "Закрыть редактор меню без сохранения?"],
        ['Достигнут лимит в 7 меню.', 'Byl dosažen limit 7 nabídek.', 'The limit of 7 menus has been reached.', "Das Limit von sieben Menüs ist erreicht.", "Достигнут лимит в семь меню."], ['Лимит меню', 'Limit nabídek', 'Menu limit', "Menülimit", "Лимит меню"],
        ['Сохранить текущие изменения перед созданием меню?', 'Uložit aktuální změny před vytvořením nabídky?', 'Save the current changes before creating a menu?', "Aktuelle Änderungen vor dem Erstellen eines Menüs speichern?", "Сохранить текущие изменения перед созданием меню?"],
        ['Удалить меню «{0}»?', 'Odstranit nabídku „{0}“?', 'Delete menu “{0}”?', "Menü „{0}“ löschen?", "Удалить меню «{0}»?"], ['Укажите название набора меню.', 'Zadejte název sady nabídek.', 'Enter a name for the menu set.', "Geben Sie einen Namen für den Menüsatz ein.", "Введите название набора меню."],
        ['Название меню', 'Název nabídky', 'Menu name', "Menüname", "Название меню"], ['Выберите хотя бы один датчик или инструмент для набора меню.', 'Vyberte do sady alespoň jeden detektor nebo nástroj.', 'Choose at least one detector or tool for this menu set.', "Wählen Sie mindestens einen Melder oder ein Werkzeug für diesen Satz.", "Выберите хотя бы один датчик или инструмент для этого набора."],
        ['Пустое меню', 'Prázdná nabídka', 'Empty menu', "Leeres Menü", "Пустое меню"], ['Создайте дополнительные наборы в редакторе меню', 'Další sady vytvoříte v editoru nabídek', 'Create additional sets in the menu editor', "Weitere Sätze im Menüeditor erstellen", "Создать дополнительные наборы в редакторе меню"],
        ['Откройте GOOM на планшете или ПК', 'Otevřete GOOM na tabletu nebo počítači', 'Open GOOM on a tablet or computer', "GOOM auf einem Tablet oder Computer öffnen", "Откройте GOOM на планшете или компьютере"], ['Увеличьте ширину окна', 'Zvětšete šířku okna', 'Make the window wider', "Fenster verbreitern", "Увеличьте ширину окна"],
        ['Версия для телефонов недоступна. Для работы с проектами используйте планшет, ноутбук или компьютер.', 'Verze pro telefony není dostupná. Použijte tablet, notebook nebo počítač.', 'The phone version is unavailable. Use a tablet, laptop, or desktop computer.', "Die Handyversion ist nicht verfügbar. Verwenden Sie ein Tablet, Notebook oder einen Computer.", "Версия для телефона недоступна. Используйте планшет, ноутбук или компьютер."],
        ['Для работы с планом нужна ширина окна от 600 пикселей. Разверните окно или поверните планшет.', 'Pro práci s výkresem je potřeba šířka okna alespoň 600 pixelů. Zvětšete okno nebo otočte tablet.', 'Working with plans requires a window at least 600 pixels wide. Enlarge the window or rotate your tablet.', "Für die Arbeit am Plan muss das Fenster mindestens 600 Pixel breit sein. Vergrößern Sie das Fenster oder drehen Sie Ihr Tablet.", "Для работы с планом нужно окно шириной от 600 пикселей. Увеличьте окно или поверните планшет."],
        ['Не удалось загрузить приложение. Обновите страницу и попробуйте снова.', 'Aplikaci nelze načíst. Obnovte stránku a zkuste to znovu.', 'Could not load the application. Refresh the page and try again.', "Anwendung konnte nicht geladen werden. Laden Sie die Seite neu und versuchen Sie es erneut.", "Не удалось загрузить приложение. Обновите страницу и попробуйте ещё раз."],
        ['Для работы с проектами используйте планшет, ноутбук или компьютер.', 'Pro práci s projekty použijte tablet, notebook nebo počítač.', 'Use a tablet, laptop, or desktop computer to work on projects.', "Verwenden Sie für Projekte ein Tablet, Notebook oder einen Computer.", "Для работы с проектами используйте планшет, ноутбук или компьютер."],
        ['Удерживать: вращение с паузой на 90°', 'Podržet: otáčení se zastavením po 90°', 'Hold: rotate with pauses at 90°', "Gedrückt halten: Drehen mit Stopps bei 90°", "Удерживать: поворот с остановками через 90°"],
        ['Zpět', 'Back', "Zurück", "Назад"], ['Smazat', 'Delete', "Löschen", "Удалить"], ['Kopírovat/Vložit', 'Copy/Paste', "Kopieren/Einfügen", "Копировать/Вставить"], ['SŘEZ BUDOVY', 'ŘEZ BUDOVOU', 'BUILDING SECTION', "GEBÄUDESCHNITT", "РАЗРЕЗ ЗДАНИЯ"],
        ['Добро пожаловать!', 'Vítejte!', 'Welcome!', "Willkommen!", "Добро пожаловать!"], ['Войдите в аккаунт Google, чтобы перейти к своим проектам.', 'Přihlaste se a pokračujte ke svým projektům.', 'Sign in to continue to your projects.', "Melden Sie sich an, um mit Ihren Projekten fortzufahren.", "Войдите, чтобы продолжить работу с проектами."],
        ['Войти или зарегистрироваться с Google', 'Pokračovat s Google', 'Continue with Google', "Mit Google fortfahren", "Продолжить через Google"], ['Выйти', 'Odhlásit se', 'Sign out', "Abmelden", "Выйти"],
        ['Перейти к проектам', 'Přejít k projektům', 'Continue to projects', "Zu den Projekten", "Перейти к проектам"], ['Выберите проект', 'Vyberte projekt', 'Choose a project', "Projekt auswählen", "Выберите проект"],
        ['Продолжить последний проект', 'Pokračovat v posledním projektu', 'Resume the last project', "Letztes Projekt fortsetzen", "Продолжить последний проект"], ['Otevřít projekt (.TECH)', 'Open project (.TECH)', "Projekt öffnen (.TECH)", "Открыть проект (.TECH)"],
        ['Назад к аккаунту', 'Zpět k účtu', 'Back to account', "Zurück zum Konto", "Назад к аккаунту"], ['Zadejte název projektu:', 'Enter a project name:', "Geben Sie den Projektnamen ein:", "Введите название проекта:"], ['Zrušit', 'Cancel', "Abbrechen", "Отмена"], ['Vytvořit', 'Create', "Erstellen", "Создать"],
        ['Закрыть', 'Zavřít', 'Close', "Schließen", "Закрыть"], ['Сохранить текущий проект', 'Uložit aktuální projekt', 'Save current project', "Aktuelles Projekt speichern", "Сохранить текущий проект"], ['Обновить', 'Obnovit', 'Refresh', "Aktualisieren", "Обновить"],
        ['Отмена', 'Zrušit', 'Cancel', "Abbrechen", "Отмена"], ['Пропустить', 'Přeskočit', 'Skip', "Überspringen", "Пропустить"], ['Nahrát výkres (PDF/IMG)', 'Upload plan (PDF/IMG)', "Plan hochladen (PDF/Bild)", "Загрузить план (PDF/изображение)"], ['Uložit / Export', 'Save / Export', "Speichern / Exportieren", "Сохранить / Экспорт"], ['Tisk', 'Print', "Drucken", "Печать"],
        ['Распознавание стен и PIR', 'Rozpoznání stěn a PIR', 'Wall detection and PIR', "Wanderkennung und PIR", "Распознавание стен и PIR"], ['Порог яркости стен (0–255)', 'Práh jasu stěn (0–255)', 'Wall brightness threshold (0–255)', "Helligkeitsgrenzwert für Wände (0–255)", "Порог яркости стен (0–255)"],
        ['Тёмные пиксели на плане становятся преградами для лучей PIR. Уменьшите порог, если текст или мебель ошибочно блокируют обзор.', 'Tmavé pixely výkresu tvoří překážky pro paprsky PIR. Pokud text nebo nábytek nesprávně blokují výhled, snižte práh.', 'Dark plan pixels block PIR rays. Lower the threshold if text or furniture incorrectly blocks coverage.', "Dunkle Planpixel blockieren PIR-Strahlen. Senken Sie den Grenzwert, wenn Text oder Möbel die Erfassung fälschlich blockieren.", "Тёмные пиксели плана блокируют лучи PIR. Уменьшите порог, если текст или мебель перекрывают зону ошибочно."],
        ['Для выбранного датчика задаётся его радиус; если PIR не выбран — это радиус для новых датчиков. Угол обзора фиксированный: 90°.', 'Dosah platí pro vybraný detektor; bez výběru PIR se použije pro nové detektory. Zorný úhel je pevně 90°.', 'Range applies to the selected detector, or to new detectors if no PIR is selected. The field of view is fixed at 90°.', "Die Reichweite gilt für den ausgewählten Melder oder für neue Melder. Der Erfassungswinkel beträgt 90°.", "Дальность применяется к выбранному датчику или к новым датчикам. Угол обзора составляет 90°."],
        ['Условный радиус луча, px (10–2000)', 'Dosah paprsku, px (10–2000)', 'Ray range, px (10–2000)', "Strahlreichweite in px (10–2000)", "Длина луча в пикселях (10–2000)"], ['Применить', 'Použít', 'Apply', "Anwenden", "Применить"],
        ['Редактор меню и значков', 'Editor nabídek a ikon', 'Menu and icon editor', "Menü- und Symboleditor", "Редактор меню и значков"], ['Значок датчика', 'Ikona detektoru', 'Detector icon', "Meldersymbol", "Значок датчика"],
        ['Цвет', 'Barva', 'Color', "Farbe", "Цвет"], ['Другой цвет', 'Vlastní barva', 'Custom color', "Eigene Farbe", "Свой цвет"], ['Заливка фигуры', 'Výplň tvaru', 'Fill shape', "Form füllen", "Заливка фигуры"],
        ['Размер', 'Velikost', 'Size', "Größe", "Размер"], ['Толщина линии', 'Tloušťka čáry', 'Line width', "Linienstärke", "Толщина линии"], ['Поворот', 'Otočení', 'Rotation', "Drehung", "Поворот"],
        ['Очистить', 'Vymazat', 'Clear', "Leeren", "Очистить"], ['Сбросить', 'Obnovit výchozí', 'Reset', "Zurücksetzen", "Сбросить"], ['Exportovat projekt', 'Export project', "Projekt exportieren", "Экспорт проекта"],
        ['Zvolte formát pro uložení. .TECH slouží pro opětovné otevření a úpravu projektu.', 'Choose a save format. Use .TECH to reopen and edit the project.', "Wählen Sie ein Speicherformat. Mit .TECH können Sie das Projekt erneut öffnen und bearbeiten.", "Выберите формат сохранения. Файл .TECH можно снова открыть для редактирования."],
        ['Uložit Projekt (.TECH)', 'Save project (.TECH)', "Projekt speichern (.TECH)", "Сохранить проект (.TECH)"], ['Export jako Obrázek (PNG)', 'Export image (PNG)', "Bild exportieren (PNG)", "Экспортировать изображение (PNG)"], ['Export jako Dokument (PDF)', 'Export document (PDF)', "Dokument exportieren (PDF)", "Экспортировать документ (PDF)"],
        ['Poznámka / Text', 'Note / Text', "Notiz / Text", "Заметка / Текст"], ['Uložit text', 'Save text', "Text speichern", "Сохранить текст"], ['Adresa prvku', 'Device address', "Geräteadresse", "Адрес устройства"], ['Smažte pole pro návrat na "Auto".', 'Clear the field to return to “Auto”.', "Leeren Sie das Feld, um wieder „Automatisch“ zu wählen.", "Очистите поле для автоматической нумерации."],
        ['❌ Adresa je obsazena!', '❌ This address is already used!', "❌ Diese Adresse ist bereits vergeben!", "❌ Этот адрес уже используется!"], ['Typ prvku', 'Device type', "Gerätetyp", "Тип устройства"], ['Adresa:', 'Address:', "Adresse:", "Адрес:"], ['Sběrnice: 1', 'Bus: 1', "Bus: 1", "Шина: 1"],
        ['Tajný režim RAMEN!', 'Secret RAMEN mode!', "Geheimer RAMEN-Modus!", "Секретный режим RAMEN!"], ['Nástroj pro přidání čerstvého ramenu byl aktivován. Můžete zapojovat nudlové kabely!', 'The fresh ramen tool is active. You can connect noodle cables!', "Das Ramen-Werkzeug ist aktiv. Verbinden Sie Ihre Nudelkabel!", "Инструмент «Рамен» активен. Можно прокладывать кабели из лапши!"], ['Chutné!', 'Delicious!', "Guten Appetit!", "Приятного аппетита!"],
        ['Indikátory: Počet aktivních prvků', 'Indicators: active device count', "Anzeigen: Anzahl aktiver Geräte", "Индикаторы: число активных устройств"], ['Kliknutím na podlaží jej otevřete', 'Select a floor to open it', "Wählen Sie ein Geschoss, um es zu öffnen", "Выберите этаж, чтобы открыть его"], ['NÁVRAT ZPĚT', 'BACK', "ZURÜCK", "НАЗАД"],
        ['Меню', 'Nabídka', 'Menu', "Menü", "Меню"], ['Název projektu...', 'Project name…', "Projektname…", "Название проекта…"], ['Přejmenovat projekt', 'Rename project', "Projekt umbenennen", "Переименовать проект"],
        ['Размер значков датчиков', 'Velikost ikon detektorů', 'Detector icon size', "Größe der Meldersymbole", "Размер значков датчиков"], ['Změnit velikost všech značek', 'Change the size of all icons', "Größe aller Symbole ändern", "Изменить размер всех значков"],
        ['Показать сетку поверх чертежа', 'Zobrazit mřížku nad výkresem', 'Show grid over the plan', "Raster über dem Plan anzeigen", "Показать сетку поверх плана"], ['Настроить стены и диапазон PIR', 'Nastavit stěny a dosah PIR', 'Configure walls and PIR range', "Wände und PIR-Reichweite einstellen", "Настроить стены и дальность PIR"],
        ['Редактировать меню и значки', 'Upravit nabídky a ikony', 'Edit menus and icons', "Menüs und Symbole bearbeiten", "Редактировать меню и значки"], ['Zobrazit / Skrýt panel nástrojů', 'Show / Hide toolbar', "Werkzeugleiste ein-/ausblenden", "Показать или скрыть панель"],
        ['Переключить набор меню', 'Přepnout sadu nabídek', 'Switch menu set', "Menüsatz wechseln", "Переключить набор меню"], ['Vyberte Sběrnici', 'Choose a bus', "Bus auswählen", "Выбрать шину"], ['Expandér zón/výstupů (EXP)', 'Zone/output expander (EXP)', "Zonen-/Ausgangserweiterung (EXP)", "Расширитель зон и выходов (EXP)"],
        ['Bezdrátový modul ABAX2', 'ABAX2 wireless module', "ABAX2-Funkmodul", "Беспроводной модуль ABAX2"], ['Klávesnice EZS', 'Alarm keypad', "Bedienteil der Alarmanlage", "Клавиатура охранной системы"], ['Prostorový PIR detektor', 'PIR motion detector', "PIR-Bewegungsmelder", "PIR-датчик движения"],
        ['Bezdrátový PIR detektor', 'Wireless PIR detector', "Funk-PIR-Melder", "Беспроводной PIR-датчик"], ['Bezdrátový Magnetický kontakt', 'Wireless magnetic contact', "Funk-Magnetkontakt", "Беспроводной магнитный контакт"], ['Detektor tříštění skla', 'Glass-break detector', "Glasbruchmelder", "Датчик разбития стекла"],
        ['Tísňové tlačítko (PANIC)', 'Panic button (PANIC)', "Überfalltaster (PANIC)", "Тревожная кнопка (PANIC)"], ['Přidat textovou poznámku', 'Add a text note', "Textnotiz hinzufügen", "Добавить текстовую заметку"], ['Skrýt / Zobrazit čáry kabelů', 'Hide / Show cable lines', "Kabeltrassen ein-/ausblenden", "Показать или скрыть кабельные трассы"],
        ['Klávesové zkratky (Nápověda)', 'Keyboard shortcuts (Help)', "Tastenkürzel (Hilfe)", "Горячие клавиши (справка)"], ['Přehled celé budovy', 'Building overview', "Gebäudeübersicht", "Обзор здания"], ['Добро пожаловать в GOOM', 'Vítejte v GOOM', 'Welcome to GOOM', "Willkommen bei GOOM", "Добро пожаловать в GOOM"],
        ['Войти или зарегистрироваться через Google', 'Přihlásit se nebo registrovat přes Google', 'Sign in or register with Google', "Mit Google anmelden oder registrieren", "Войти или зарегистрироваться через Google"], ['Např. Rodinný dom Praha...', 'Např. Rodinný dům Praha…', 'E.g. Family house, Prague…', "Z. B. Einfamilienhaus in Prag…", "Например, жилой дом в Праге…"],
        ['Закрыть облачные проекты', 'Zavřít cloudové projekty', 'Close cloud projects', "Cloud-Projekte schließen", "Закрыть облачные проекты"], ['Закрыть редактор', 'Zavřít editor', 'Close editor', "Editor schließen", "Закрыть редактор"],
        ['Меню и датчики для редактирования', 'Nabídky a detektory k úpravě', 'Menus and detectors to edit', "Menüs und Melder zur Bearbeitung", "Меню и датчики для редактирования"], ['Тип устройства для значка', 'Typ zařízení pro ikonu', 'Device type for the icon', "Gerätetyp für das Symbol", "Тип устройства для значка"],
        ['Холст редактирования значка', 'Plátno editoru ikon', 'Icon editing canvas', "Zeichenfläche für das Symbol", "Холст редактирования значка"], ['Действия с холстом', 'Akce plátna', 'Canvas actions', "Zeichenflächen-Aktionen", "Действия с холстом"], ['Отменить действие', 'Vrátit akci', 'Undo', "Rückgängig", "Отменить"],
        ['Добавить фигуру', 'Přidat tvar', 'Add shape', "Form hinzufügen", "Добавить фигуру"], ['Круг', 'Kruh', 'Circle', "Kreis", "Круг"], ['Квадрат', 'Čtverec', 'Square', "Quadrat", "Квадрат"], ['Скруглённый квадрат', 'Zaoblený čtverec', 'Rounded square', "Abgerundetes Quadrat", "Скруглённый квадрат"],
        ['Треугольник', 'Trojúhelník', 'Triangle', "Dreieck", "Треугольник"], ['Ромб', 'Kosočtverec', 'Diamond', "Raute", "Ромб"], ['Линия', 'Čára', 'Line', "Linie", "Линия"], ['Текст', 'Text', 'Text', "Text", "Текст"],
        ['Палитра цветов', 'Paleta barev', 'Color palette', "Farbpalette", "Палитра"], ['Выбрать другой цвет', 'Vybrat vlastní barvu', 'Choose a custom color', "Eigene Farbe wählen", "Выбрать свой цвет"],
        ['Удалить фигуру', 'Odstranit tvar', 'Delete shape', "Form löschen", "Удалить фигуру"], ['Сбросить значок', 'Obnovit výchozí ikonu', 'Reset icon', "Symbol zurücksetzen", "Сбросить значок"], ['Zadejte text...', 'Enter text…', "Text eingeben…", "Введите текст…"],
        ['Uložit', 'Save', "Speichern", "Сохранить"], ['Návrat na půdorys', 'Return to floor plan', "Zum Grundriss zurück", "Вернуться к плану"], ['Skrýt kabely', 'Hide cables', "Kabel ausblenden", "Скрыть трассы"], ['Zobrazit kabely', 'Show cables', "Kabel einblenden", "Показать трассы"],
        ['PIR Detektor', 'PIR detector', "PIR-Melder", "PIR-датчик"], ['Modul ABAX2', 'ABAX2 module', "ABAX2-Modul", "Модуль ABAX2"],
        // Registration, account, and company cloud access.
        ['Jazyk', 'Language', "Sprache", "Язык"], ['Zpět', 'Back', "Zurück", "Назад"], ['Přihlásit se e-mailem', 'Sign in with email', "Mit E-Mail anmelden", "Войти по почте"], ['Vytvořit účet', 'Create an account', "Konto erstellen", "Создать аккаунт"],
        ['Přihlášení', 'Sign in', "Anmeldung", "Вход"], ['Registrace', 'Registration', "Registrierung", "Регистрация"], ['E-mail', 'Email', "E-Mail", "Электронная почта"], ['Heslo', 'Password', "Passwort", "Пароль"], ['Potvrdit heslo', 'Confirm password', "Passwort bestätigen", "Подтвердите пароль"],
        ['Jméno', 'Name', "Name", "Имя"], ['Typ účtu', 'Account type', "Kontotyp", "Тип аккаунта"], ['Osobní účet', 'Personal account', "Privatkonto", "Личный аккаунт"], ['Firma', 'Company', "Firma", "Компания"], ['IČO', 'Company ID (IČO)', "Unternehmensnummer (IČO)", "Номер компании (IČO)"],
        ['8 číslic včetně kontrolní číslice', '8 digits including the check digit', "8 Ziffern einschließlich Prüfziffer", "8 цифр, включая контрольную"], ['Přihlásit se', 'Sign in', "Anmelden", "Войти"], ['Registrovat', 'Register', "Registrieren", "Зарегистрироваться"], ['Zapomenuté heslo?', 'Forgot password?', "Passwort vergessen?", "Забыли пароль?"],
        ['Použijte libovolnou e-mailovou adresu. Heslo musí mít alespoň 8 znaků.', 'Use any email address. Your password must contain at least 8 characters.', "Sie können eine beliebige E-Mail-Adresse verwenden. Das Passwort benötigt mindestens 8 Zeichen.", "Можно использовать любую почту. Пароль должен содержать не менее 8 символов."],
        ['Po ověření e-mailu získá firemní účet automaticky klíč ke cloudovému úložišti.', 'After email verification, a company account automatically receives a cloud storage key.', "Nach Bestätigung der E-Mail-Adresse erhält ein Firmenkonto automatisch einen Cloud-Schlüssel.", "После подтверждения почты компания автоматически получает ключ для облака."],
        ['Uživatelský účet', 'User account', "Benutzerkonto", "Аккаунт"], ['Údaje uživatele', 'User information', "Benutzerdaten", "Данные пользователя"], ['Nastavení účtu', 'Account settings', "Kontoeinstellungen", "Настройки аккаунта"], ['Uložit údaje', 'Save details', "Daten speichern", "Сохранить данные"],
        ['Ověřit e-mail', 'Verify email', "E-Mail bestätigen", "Подтвердить почту"], ['E-mail jsem ověřil(a)', 'I have verified my email', "Ich habe meine E-Mail bestätigt", "Я подтвердил почту"], ['E-mail je ověřen', 'Email verified', "E-Mail bestätigt", "Почта подтверждена"],
        ['E-mail zatím není ověřen', 'Email not verified yet', "E-Mail noch nicht bestätigt", "Почта ещё не подтверждена"], ['Cloudové úložiště', 'Cloud storage', "Cloud-Speicher", "Облачное хранилище"], ['Cloudový klíč', 'Cloud key', "Cloud-Schlüssel", "Ключ для облака"],
        ['Zkopírovat klíč', 'Copy key', "Schlüssel kopieren", "Скопировать ключ"], ['Vygenerovat nový klíč', 'Generate a new key', "Neuen Schlüssel erzeugen", "Создать новый ключ"], ['Klíč byl zkopírován.', 'Key copied.', "Schlüssel kopiert.", "Ключ скопирован."],
        ['Klíč uložte na bezpečné místo. Plný klíč se zobrazí pouze po jeho vydání.', 'Store the key in a safe place. The full key is shown only when issued.', "Bewahren Sie den Schlüssel sicher auf. Er wird nur bei der Ausgabe vollständig angezeigt.", "Храните ключ в безопасном месте. Полностью он показывается только при выдаче."],
        ['Klíč je vydán pro tento firemní účet. Cloudové projekty jsou dostupné.', 'A key has been issued for this company account. Cloud projects are available.', "Für dieses Firmenkonto wurde ein Schlüssel ausgestellt. Cloud-Projekte sind verfügbar.", "Компании выдан ключ. Облачные проекты доступны."],
        ['Cloudové úložiště je dostupné firemním účtům s vydaným klíčem.', 'Cloud storage is available to company accounts with an issued key.', "Cloud-Speicher ist für Firmenkonten mit ausgestelltem Schlüssel verfügbar.", "Облачное хранилище доступно компаниям с выданным ключом."],
        ['Pro automatické vydání klíče ověřte svůj e-mail.', 'Verify your email to receive a key automatically.', "Bestätigen Sie die E-Mail-Adresse, um automatisch einen Schlüssel zu erhalten.", "Подтвердите почту, чтобы автоматически получить ключ."],
        ['Zadejte platné osmimístné IČO.', 'Enter a valid eight-digit Czech company ID (IČO).', "Geben Sie eine gültige achtstellige tschechische Unternehmensnummer (IČO) ein.", "Введите действительный восьмизначный чешский IČO."], ['Zadejte své jméno.', 'Enter your name.', "Geben Sie Ihren Namen ein.", "Введите своё имя."],
        ['Hesla se neshodují.', 'The passwords do not match.', "Die Passwörter stimmen nicht überein.", "Пароли не совпадают."], ['Heslo musí mít alespoň 8 znaků.', 'Your password must contain at least 8 characters.', "Ihr Passwort muss mindestens 8 Zeichen enthalten.", "Пароль должен содержать не менее 8 символов."],
        ['Zadejte platnou e-mailovou adresu.', 'Enter a valid email address.', "Geben Sie eine gültige E-Mail-Adresse ein.", "Введите действительный адрес почты."], ['Vyplňte e-mail a heslo.', 'Enter your email and password.', "Geben Sie Ihre E-Mail-Adresse und Ihr Passwort ein.", "Введите электронную почту и пароль."],
        ['Tato e-mailová adresa již má účet. Přihlaste se nebo obnovte heslo.', 'This email address already has an account. Sign in or reset your password.', "Für diese E-Mail-Adresse gibt es bereits ein Konto. Melden Sie sich an oder setzen Sie Ihr Passwort zurück.", "Аккаунт с такой почтой уже есть. Войдите или восстановите пароль."],
        ['Nesprávný e-mail nebo heslo.', 'Incorrect email or password.', "E-Mail-Adresse oder Passwort ist falsch.", "Неверная почта или пароль."], ['Přihlášení e-mailem není ve Firebase povoleno.', 'Email/password sign-in is not enabled in Firebase.', "Anmeldung mit E-Mail und Passwort ist in Firebase deaktiviert.", "Вход по почте и паролю не включён в Firebase."],
        ['Příliš mnoho pokusů. Zkuste to později.', 'Too many attempts. Try again later.', "Zu viele Versuche. Versuchen Sie es später erneut.", "Слишком много попыток. Попробуйте позже."], ['Zkontrolujte připojení k internetu.', 'Check your internet connection.', "Prüfen Sie Ihre Internetverbindung.", "Проверьте подключение к интернету."],
        ['Ověřovací e-mail byl odeslán. Po potvrzení klikněte na „E-mail jsem ověřil(a)“.', 'Verification email sent. After confirming it, select “I have verified my email”.', "Wir haben eine Bestätigungs-E-Mail gesendet. Klicken Sie danach auf „Ich habe meine E-Mail bestätigt“.", "Письмо отправлено. После подтверждения нажмите «Я подтвердил почту»."],
        ['Pokud účet existuje, obdržíte e-mail pro obnovení hesla.', 'If the account exists, you will receive a password reset email.', "Wenn das Konto existiert, erhalten Sie eine E-Mail zum Zurücksetzen des Passworts.", "Если аккаунт существует, вы получите письмо для восстановления пароля."],
        ['Údaje účtu byly uloženy.', 'Account details saved.', "Kontodaten gespeichert.", "Данные аккаунта сохранены."], ['Načítání údajů účtu…', 'Loading account details…', "Kontodaten werden geladen…", "Загрузка данных аккаунта…"],
        ['Údaje účtu nelze načíst. Zkuste to znovu.', 'Could not load account details. Try again.', "Kontodaten konnten nicht geladen werden. Versuchen Sie es erneut.", "Не удалось загрузить данные аккаунта. Попробуйте ещё раз."],
        ['Cloudový klíč nelze vydat. Zkuste to znovu.', 'Could not issue the cloud key. Try again.', "Cloud-Schlüssel konnte nicht ausgestellt werden. Versuchen Sie es erneut.", "Не удалось выдать ключ для облака. Попробуйте ещё раз."],
        ['Obnovit údaje', 'Refresh account details', "Kontodaten aktualisieren", "Обновить данные аккаунта"], ['Vydávání cloudového klíče…', 'Issuing a cloud key…', "Cloud-Schlüssel wird ausgestellt…", "Выдаём ключ для облака…"],
        ['Vygenerovat nový klíč? Předchozí klíč bude nahrazen.', 'Generate a new key? The previous key will be replaced.', "Neuen Schlüssel erzeugen? Der bisherige Schlüssel wird ersetzt.", "Создать новый ключ? Предыдущий ключ будет заменён."],
        ['Přihlaste se ke svému účtu.', 'Sign in to your account.', "Melden Sie sich bei Ihrem Konto an.", "Войдите в аккаунт."], ['Ukládání…', 'Saving…', "Wird gespeichert…", "Сохраняем…"], ['Registrace se nezdařila', 'Registration failed', "Registrierung fehlgeschlagen", "Не удалось зарегистрироваться"],
        ['Přihlášení se nezdařilo', 'Sign-in failed', "Anmeldung fehlgeschlagen", "Не удалось войти"], ['Účet je založen, ale údaje se nepodařilo uložit. Doplňte je v nastavení účtu.', 'Your account was created, but its details could not be saved. Complete them in account settings.', "Das Konto wurde erstellt, die Daten konnten aber nicht gespeichert werden. Ergänzen Sie sie in den Kontoeinstellungen.", "Аккаунт создан, но данные не сохранились. Заполните их в настройках."],
        ['Ověření e-mailu se nepodařilo odeslat. Zkuste to z nastavení účtu.', 'Could not send the verification email. Try again from account settings.', "Bestätigungs-E-Mail konnte nicht gesendet werden. Versuchen Sie es in den Kontoeinstellungen erneut.", "Не удалось отправить письмо. Попробуйте ещё раз в настройках аккаунта."],
        ['PROJECT je aktivní.', 'PROJECT is active.', "PROJECT ist aktiv.", "PROJECT активен."], ['Váš účet používá bezplatnou verzi.', 'Your account is on the free plan.', "Ihr Konto nutzt den kostenlosen Tarif.", "У вас бесплатная версия."],
        ['PROJECT je aktivní. Cloudové úložiště je připraveno.', 'PROJECT is active. Cloud storage is ready.', "PROJECT ist aktiv. Der Cloud-Speicher ist verfügbar.", "PROJECT активен. Облачное хранилище доступно."], ['Cloudové úložiště je součástí PROJECT.', 'Cloud storage is included in PROJECT.', "Der Cloud-Speicher ist in PROJECT enthalten.", "Облачное хранилище входит в PROJECT."],
        ['Cena a podmínky se zobrazí na zabezpečené platební stránce.', 'The price and terms are shown on the secure payment page.', "Preis und Bedingungen stehen auf der sicheren Zahlungsseite.", "Цена и условия будут показаны на странице оплаты."],
        ['Před nákupem potvrďte svou e-mailovou adresu v nastavení účtu.', 'Before purchasing, confirm your email in account settings.', "Bestätigen Sie vor dem Kauf Ihre E-Mail-Adresse in den Kontoeinstellungen.", "Перед покупкой подтвердите почту в настройках аккаунта."],
        ['Připravujeme zabezpečenou platbu…', 'Preparing secure checkout…', "Sichere Zahlung wird vorbereitet…", "Готовим страницу оплаты…"], ['Platbu nyní nelze otevřít. Zkuste to později.', 'Checkout is unavailable. Please try again later.', "Die Zahlung ist derzeit nicht verfügbar. Versuchen Sie es später erneut.", "Оплата временно недоступна. Попробуйте позже."],
        ['Ověřujeme platbu. PROJECT se aktivuje po potvrzení úhrady.', 'Verifying payment. PROJECT activates after payment is confirmed.', "Die Zahlung wird geprüft. PROJECT wird nach Bestätigung freigeschaltet.", "Проверяем оплату. PROJECT активируется после её подтверждения."],
        ['Platba byla zrušena. Váš účet zůstává beze změny.', 'Payment was cancelled. Your account is unchanged.', "Die Zahlung wurde abgebrochen. Ihr Konto bleibt unverändert.", "Оплата отменена. Данные аккаунта не изменились."],
        ['Rozšiřte svůj účet o nástroje PROJECT.', 'Upgrade your account with PROJECT tools.', "Erweitern Sie Ihr Konto um PROJECT-Funktionen.", "Добавьте в свой аккаунт функции PROJECT."], ['Cloudové ukládání plánů', 'Cloud plan storage', "Pläne in der Cloud speichern", "Хранение планов в облаке"],
        ['Editor nabídek a ikon', 'Menu and icon editor', "Menü- und Symboleditor", "Редактор меню и значков"], ['Tipy při plánování', 'Planning hints', "Planungstipps", "Подсказки по проектированию"], ['Koupit PROJECT', 'Buy PROJECT', "PROJECT kaufen", "Купить PROJECT"],
        ['Jednorázová licence pro PZTS', 'One-time PZTS license', "Einmallizenz für PZTS", "Разовая лицензия PZTS"], ['PZTS, EPS, CCTV a SK', 'PZTS, EPS, CCTV and SK', "PZTS, EPS, CCTV und SK", "PZTS, EPS, CCTV и SK"],
        ['Firemní údaje můžete upravit později. PROJECT je dostupné v uživatelském účtu.', 'You can edit company details later. PROJECT is available in your account.', "Sie können Firmendaten später bearbeiten. PROJECT ist im Benutzerkonto verfügbar.", "Данные компании можно изменить позже. PROJECT доступен в аккаунте."],
        ['Ovládání detektoru', 'Detector controls', "Melder-Steuerung", "Управление датчиком"], ['Výběr', 'Select', "Auswählen", "Выбрать"], ['Posun', 'Pan', "Verschieben", "Перемещение"], ['Výběr detektoru', 'Select detector', "Melder auswählen", "Выбрать датчик"],
        ['Posun plánu', 'Pan plan', "Plan verschieben", "Переместить план"], ['Otočit o 90°', 'Rotate 90°', "Um 90° drehen", "Повернуть на 90°"], ['Duplikovat', 'Duplicate', "Duplizieren", "Дублировать"], ['Odstranit vybrané', 'Delete selected', "Auswahl löschen", "Удалить выделенное"],
        ['Synchronizace je připravena', 'Sync is ready', "Synchronisierung bereit", "Синхронизация готова"], ['Místní ukládání', 'Local saving', "Lokal speichern", "Локальное сохранение"],
        ['PZTS PROJECT — 39 € / měsíc', 'PZTS PROJECT — €39 / month', "PZTS PROJECT — 39 € pro Monat", "PZTS PROJECT — 39 € в месяц"], ['PROJECT Suite — 99 € / měsíc', 'PROJECT Suite — €99 / month', "PROJECT Suite — 99 € pro Monat", "PROJECT Suite — 99 € в месяц"],
        ['Měsíční předplatné PZTS', 'Monthly PZTS subscription', "PZTS-Monatsabo", "Месячная подписка PZTS"], ['Měsíčně: PZTS, EPS, CCTV a SK', 'Monthly: PZTS, EPS, CCTV and SK', "Monatlich: PZTS, EPS, CCTV und SK", "Ежемесячно: PZTS, EPS, CCTV и SK"],
        ['Předplatné se obnovuje každý měsíc od data nákupu. Automatické obnovení můžete zrušit v účtu.', 'Your subscription renews monthly from the purchase date. You can cancel automatic renewal in your account.', "Das Abo verlängert sich monatlich ab Kaufdatum. Die Verlängerung lässt sich im Konto kündigen.", "Подписка ежемесячно продлевается с даты покупки. Автопродление можно отключить в аккаунте."],
        ['Spravovat předplatné', 'Manage subscription', "Abo verwalten", "Управлять подпиской"], ['Přístup do: {0}', 'Access until: {0}', "Zugang bis: {0}", "Доступ до {0}"],
        ['Automatické obnovení je vypnuto.', 'Automatic renewal is off.', "Automatische Verlängerung ist aus.", "Автопродление отключено."], ['Měsíční předplatné.', 'Monthly subscription.', "Monatsabo.", "Месячная подписка."],
        ['Správu předplatného nyní nelze otevřít. Zkuste to později.', 'Subscription management is unavailable. Please try again later.', "Die Abo-Verwaltung ist derzeit nicht verfügbar. Versuchen Sie es später erneut.", "Управление подпиской временно недоступно. Попробуйте позже."], ['Adresa', 'Address', "Adresse", "Адрес"],
        ['Máte již předplatné. Spravujte je v uživatelském účtu.', 'You already have a subscription. Manage it in your account.', "Sie haben bereits ein Abo. Verwalten Sie es in Ihrem Konto.", "У вас уже есть подписка. Управлять ею можно в аккаунте."],
        ["Zobrazení výkresu","Drawing appearance", "Plandarstellung", "Отображение чертежа"],
        ["Bílé čáry na tmavém pozadí","White lines on a dark background", "Weiße Linien auf dunklem Hintergrund", "Белые линии на тёмном фоне"],
        ["Původní výkres","Original drawing", "Originalplan", "Исходный чертёж"],
        ["Stěny se rozpoznávají z původního výkresu bez ohledu na barvu zobrazení. Tmavý text a nábytek mohou také blokovat paprsky. Práh upravte podle podkladu.","Walls are detected from the original drawing regardless of its display colours. Dark text and furniture can also block rays. Adjust the threshold to suit your source.", "Wände werden anhand des Originalplans erkannt. Auch dunkler Text und Möbel können Strahlen blockieren. Passen Sie die Schwelle an den Plan an.", "Стены распознаются по исходному чертежу. Тёмный текст и мебель тоже могут блокировать лучи. Настройте порог под ваш план."],
        ["Výkres nelze načíst.","Could not load the drawing.", "Plan konnte nicht geladen werden.", "Не удалось загрузить чертёж."],
        ["Knihovna PDF není dostupná.","The PDF library is unavailable.", "Die PDF-Bibliothek ist nicht verfügbar.", "Библиотека PDF недоступна."],
        ["Knihovna DXF není dostupná.","The DXF library is unavailable.", "Die DXF-Bibliothek ist nicht verfügbar.", "Библиотека DXF недоступна."],
        ["DXF neobsahuje podporované čáry.","The DXF contains no supported lines.", "Die DXF-Datei enthält keine unterstützten Linien.", "В DXF нет поддерживаемых линий."],
        ["Číslo stránky PDF (1–{0})","PDF page number (1–{0})", "PDF-Seitennummer (1–{0})", "Номер страницы PDF (1–{0})"],
        ["Import PDF","Import PDF", "PDF importieren", "Импорт PDF"],
        ["Import DXF","Import DXF", "DXF importieren", "Импорт DXF"],
        ["Neplatné číslo stránky.","Invalid page number.", "Ungültige Seitennummer.", "Неверный номер страницы."],
        ["Obrázek je příliš velký. Použijte nejvýše 24 Mpx a stranu 16000 px.","The image is too large. Use at most 24 MP and a side length of 16000 px.", "Das Bild ist zu groß. Verwenden Sie maximal 24 MP und 16.000 Pixel pro Seite.", "Изображение слишком большое. Максимум 24 Мп и 16 000 пикселей по стороне."],
        ["Nepodporované prvky DXF: {0}","Unsupported DXF entities: {0}", "Nicht unterstützte DXF-Elemente: {0}", "Неподдерживаемые элементы DXF: {0}"],
        ["Chyba načítání výkresu","Drawing import error", "Fehler beim Planimport", "Ошибка загрузки чертежа"],
        ["Celé podlaží, nezávisle na přiblížení obrazovky.","The entire floor, independent of your screen zoom.", "Das ganze Geschoss, unabhängig vom Bildschirmzoom.", "Весь этаж независимо от масштаба на экране."],
        ["Formát papíru","Paper size", "Papierformat", "Формат бумаги"],
        ["Orientace","Orientation", "Ausrichtung", "Ориентация"],
        ["Automaticky","Automatic", "Automatisch", "Автоматически"],
        ["Na šířku","Landscape", "Querformat", "Альбомная"],
        ["Na výšku","Portrait", "Hochformat", "Книжная"],
        ["Kvalita","Quality", "Qualität", "Качество"],
        ["Pozadí","Background", "Hintergrund", "Фон"],
        ["Světlý výkres","Light drawing", "Heller Plan", "Светлый чертёж"],
        ["Tmavý výkres","Dark drawing", "Dunkler Plan", "Тёмный чертёж"],
        ["Zóny detektorů","Detector coverage", "Erfassungsbereiche", "Зоны датчиков"],
        ["SVG zachová vektorové čáry DXF, detektory a kabely. Fotografie a rastrové plány zůstanou rastrové.","SVG preserves DXF vector lines, detectors and cables. Photos and raster plans remain raster images.", "SVG erhält DXF-Vektorlinien, Melder und Kabel. Fotos und Rasterpläne bleiben Rasterbilder.", "SVG сохраняет векторные линии DXF, датчики и кабели. Фотографии и растровые планы остаются растровыми."],
        ["Náhled celého podlaží","Full floor preview", "Vorschau des gesamten Geschosses", "Предпросмотр всего этажа"],
        ["Výstup je příliš velký.","The output is too large.", "Die Ausgabe ist zu groß.", "Выходной файл слишком большой."],
        ["Příprava výstupu…","Preparing output…", "Ausgabe wird vorbereitet…", "Подготовка файла…"],
        ["Výstup nelze uložit.","Could not save the output.", "Ausgabe konnte nicht gespeichert werden.", "Не удалось сохранить файл."],
        ["Výstup je připraven.","The output is ready.", "Die Ausgabe ist fertig.", "Файл готов."],
        ["Výstup se nezdařil.","Output failed.", "Ausgabe fehlgeschlagen.", "Не удалось подготовить файл."],
        ['Zvýraznit rozpoznané překážky','Highlight detected obstacles', "Erkannte Hindernisse hervorheben", "Подсветить распознанные препятствия"],
        ["Citlivost rozpoznání stěn","Wall detection sensitivity", "Empfindlichkeit der Wanderkennung", "Чувствительность распознавания стен"],
        ["Bez překážek","No obstacles", "Keine Hindernisse", "Без препятствий"],
        ["I jemné čáry","Even faint lines", "Auch feine Linien", "Даже тонкие линии"],
        ["Citlivost se projeví ihned. Vyšší hodnota zachytí i světlé čáry; text a nábytek mohou být také překážkou.","Sensitivity updates immediately. Higher values detect faint lines; text and furniture may also be obstacles.", "Die Empfindlichkeit wird sofort angewendet. Höhere Werte erkennen helle Linien. Auch Text und Möbel können Hindernisse sein.", "Чувствительность меняется сразу. При высоких значениях распознаются светлые линии. Текст и мебель тоже могут стать препятствиями."],
        ["PŘEHLED BUDOVY","BUILDING OVERVIEW", "GEBÄUDEÜBERSICHT", "ОБЗОР ЗДАНИЯ"],
        ["Dům, průmyslová budova a věž","House, industrial building and tower", "Haus, Industriegebäude und Turm", "Дом, завод и башня"],
        ["Podlaží","Floors", "Geschosse", "Этажи"],
        ["Adresy zón","Zone addresses", "Zonenadressen", "Адреса зон"],
        ["Bez zón","No zones", "Keine Zonen", "Нет зон"],
        ["Bez ústředny","No control panel", "Keine Zentrale", "Без централи"],
        ["Ústředna","Control panel", "Zentrale", "Централь"],
        ["detektorů","detectors", "Melder", "датчиков"],
        ["Detektory: {0}","Detectors: {0}", "Melder: {0}", "Датчики: {0}"],
        ["Zóny: {0}","Zones: {0}", "Zonen: {0}", "Зоны: {0}"],
        ["Prvky: {0}","Devices: {0}", "Geräte: {0}", "Устройства: {0}"],
        ["Ústředny: {0}","Control panels: {0}", "Zentralen: {0}", "Централи: {0}"],
        ["Ústředna: {0}","Control panel: {0}", "Zentrale: {0}", "Централь: {0}"],
        ["Ústředna není umístěna","No control panel placed", "Keine Zentrale platziert", "Централь не размещена"],
        ["Hlavní ústředna","Main control panel", "Hauptzentrale", "Главная централь"],
        ["Hlavní ústředna: {0}","Main control panel: {0}", "Hauptzentrale: {0}", "Главная централь: {0}"],
        ["detektor","detector", "Melder", "датчик"],
        ["detektory","detectors", "Melder", "датчики"],
        ["PIR detektor","PIR detector", "PIR-Melder", "PIR-датчик"],
        ["Bezdrátový magnet","Wireless contact", "Funkkontakt", "Беспроводной контакт"],
        ["Detektor rozbití skla","Glass-break detector", "Glasbruchmelder", "Датчик разбития стекла"],
        ["Neaktivní detektor","Inactive detector", "Inaktiver Melder", "Неактивный датчик"],
        ["Detektor","Detector", "Melder", "Датчик"],
        ["Otočit doleva","Rotate left", "Nach links drehen", "Повернуть влево"],
        ["Otočit doprava","Rotate right", "Nach rechts drehen", "Повернуть вправо"],
        ["Podržet: otočit doprava / doleva","Hold: rotate right / left", "Gedrückt halten: nach rechts oder links drehen", "Удерживать: поворот вправо или влево"],
        ['Vyberte podlaží', 'Select a floor', "Geschoss auswählen", "Выберите этаж"], ['Zpět na půdorys', 'Back to plan', "Zum Grundriss zurück", "Вернуться к плану"], ['Počet prvků: {0}', 'Device count: {0}', "Anzahl Geräte: {0}", "Количество устройств: {0}"], ['ZPĚT', 'BACK', "ZURÜCK", "НАЗАД"]
    ];

    const locales = { cs: 'cs-CZ', en: 'en-GB', de: 'de-DE', ru: 'ru-RU' };
    const welcomeAcronyms = { cs: 'PZTS', en: 'I&HAS', de: 'GMA', ru: 'СОТС' };
    const normalizeLanguage = value => Object.hasOwn(locales, value) ? value : 'cs';
    const catalog = new Map();
    for (const row of rows) {
        const [source, cs, en, de, ru] = row.length === 4 ? [row[0], ...row] : row;
        const entry = { cs, en, de, ru };
        for (const alias of [source, cs, en, de, ru]) if (!catalog.has(alias)) catalog.set(alias, entry);
    }
    let language = 'cs';
    try { language = normalizeLanguage(localStorage.getItem('goom.language')); } catch {}
    const bindings = new WeakMap();
    const attributeBindings = new WeakMap();
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
            for (const translation of Object.values(entry)) renderedMessages.set(format(translation, values), { source, values });
            while (renderedMessages.size > 5000) renderedMessages.delete(renderedMessages.keys().next().value);
        }
        return format(catalog.get(String(source))?.[language] ?? String(source), values);
    };
    window.getGoomLanguage = () => language;
    window.getGoomLocale = () => locales[language];

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
        let attributes = attributeBindings.get(element);
        for (const attr of ['title', 'aria-label', 'placeholder', 'data-tooltip']) {
            const value = element.getAttribute(attr);
            if (!value) { attributes?.delete(attr); continue; }
            const previous = attributes?.get(attr);
            const source = previous?.last === value ? previous.source : value;
            if (catalog.has(source) || renderedMessages.has(source)) {
                const translated = tr(source);
                if (!attributes) { attributes = new Map(); attributeBindings.set(element, attributes); }
                attributes.set(attr, { source, last: translated });
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
    function localizeWelcomeBrand() {
        const brand = document.querySelector('#welcomeModal .welcome-brand');
        if (brand) brand.textContent = welcomeAcronyms[language];
    }
    window.setGoomLanguage = value => {
        language = normalizeLanguage(value);
        document.documentElement.lang = language;
        try { localStorage.setItem('goom.language', language); } catch {}
        localize();
        localizeWelcomeBrand();
        document.querySelectorAll('[data-language-select]').forEach(select => { select.value = language; });
        window.dispatchEvent(new Event('goom-language-changed'));
        window.requestRedraw?.();
    };
    document.documentElement.lang = language;
    document.addEventListener('DOMContentLoaded', () => {
        localize();
        localizeWelcomeBrand();
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
