https://kykyxdd.github.io/biblioGlobus-fligths/


Сборка проекта : gulp
Build собирается в папку dist/

Нарезать картинки : convert -crop 500x400 737-800_VP-BRS.jpg -quality 70 lower_%02d.jpg

Маленькое изоражение: 1000х800

Изображение для навигации: 300х240

Для сборки архива с проектом можно использовать команды:
- gulp build_zip
- gulp build_zip --env russia
- gulp build_zip --env redwings