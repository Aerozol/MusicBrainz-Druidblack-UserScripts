// ==UserScript==
// @name        MusicBrainz: Import and Search from Yandex Music
// @description Для страниц альбомов – импорт релиза в MusicBrainz и поиск; для страниц исполнителей – поиска исполнителя на MusicBrainz.
// @version     2025.01.00.3
// @author      Druidblack
// @namespace   https://github.com/Druidblack/MusicBrainz-UserScripts
//
// @include     *://music.yandex.ru/*
//
// @require     https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js
// @require     https://gist.github.com/raw/2625891/waitForKeyElements.js
//
// @run-at      document-start
// @grant       none
// @icon        https://musicbrainz.org/favicon.ico
//
// @downloadURL  https://github.com/Druidblack/MusicBrainz-UserScripts/raw/main/yandexmusic_import_album.user.js
// @updateURL   https://github.com/Druidblack/MusicBrainz-UserScripts/raw/main/yandexmusic_import_album.user.js
// ==/UserScript==

(function() {
  // Изолируем нашу копию jQuery
  var myJQ = jQuery.noConflict(true);

  // Переменные для страниц альбомов
  var myform = document.createElement("form");
  var album = '', year = 0, country = 'XW', type = 'album';
  var artistList = [];
  var m;
  var buttons;

  myJQ(document).ready(function(){
    // Ждем появления контейнера для кнопок – он есть на обеих страницах
    waitForKeyElements(".d-generic-page-head__main-actions", run);
  });

  function run() {
    var url = document.location.href;
    if (/\/album\//.test(url)) {
      extractYandexAlbum();
    }
    else if (/\/artist\//.test(url)) {
      extractYandexArtist();
    }
  }

  // Функция для страницы альбома
  function extractYandexAlbum() {
    myform.innerHTML = '';

    // Извлекаем название альбома
    album = myJQ(".page-album__title span.deco-typo").first().text().trim();
    if (!album) { album = myJQ(".page-album__title").text().trim(); }

    // Определяем тип релиза
    var typeText = myJQ(".page-album__types .stamp__entity").first().text().trim();
    if (typeText.indexOf("Сингл") !== -1) { type = "Single"; }
    else if (typeText.indexOf("Альбом") !== -1) { type = "Album"; }
    else { type = "Album"; }

    // Извлекаем исполнителей для альбома
    artistList = [];
    myJQ(".d-artists-many .d-artists a.d-link, .page-album__artists-short a.d-link").each(function(){
      var name = myJQ(this).text().trim();
      if (name) { artistList.push(name); }
    });
    if (artistList.length === 0) {
      var fallback = myJQ(".page-album__artist").text().trim() || myJQ("a.album__artist").text().trim();
      if (fallback) { artistList.push(fallback); }
    }

    // Извлекаем название лейбла
    var label = myJQ(".page-album__label a.d-link").text().trim();

    // Извлекаем год релиза (используя .page-album__year или span.typo.deco-typo-secondary)
    var releaseYearText = myJQ(".page-album__year, span.typo.deco-typo-secondary").first().text().trim();
    if (releaseYearText) {
      var match = releaseYearText.match(/\d{4}/);
      if (match) { year = match[0]; }
    }

    // Извлекаем annotation (например, "deluxe edition")
    var annotationText = myJQ(".page-album__version.link").text().trim();
    if (annotationText) { add_field("annotation", annotationText); }

    // Извлечение списка треков
    var trackElements = myJQ(".d-track");
    if (trackElements.length === 0) {
      trackElements = myJQ(".track__list .track");
    }
    trackElements.each(function(index) {
      var trackNumber = myJQ(this).find(".d-track__id").text().trim();
      var trackTitle = myJQ(this).find(".d-track__name .d-track__title").text().trim();
      var durationStr = myJQ(this).find(".d-track__duration").text().trim();
      if (!durationStr) { durationStr = myJQ(this).find(".d-track__info span.typo-track").text().trim(); }
      var trackDuration = parseDuration(durationStr);

      // Если позиция не требуется, можно закомментировать следующую строку
      // if (trackNumber) { add_field("mediums.0.track." + index + ".position", trackNumber); }

      add_field("mediums.0.track." + index + ".name", trackTitle);
      add_field("mediums.0.track." + index + ".length", trackDuration);
      var trackArtists = [];
      myJQ(this).find(".d-track__artists a.deco-link").each(function(){
        var ta = myJQ(this).text().trim();
        if (ta) { trackArtists.push(ta); }
      });
      for (var j = 0; j < trackArtists.length; j++) {
        add_field("mediums.0.track." + index + ".artist_credit.names." + j + ".name", trackArtists[j]);
      }
    });

    // Поля релиза
    add_field("mediums.0.format", 'Digital Media');
    add_field("name", album);
    for (var i = 0; i < artistList.length; i++) {
      add_field("artist_credit.names." + i + ".artist.name", artistList[i]);
    }
    add_field("labels.0.name", label);
    add_field("packaging", 'None');
    add_field("date.year", year);
    add_field("country", country);
    add_field("status", "official");
    add_field("type", type);
    add_field("edit_note", "Imported from: " + document.location.href + " using script https://github.com/Druidblack/MusicBrainz-UserScripts/blob/main/yandexmusic_import_album.user.js");
    add_field("urls.0.link_type", "980");  // При необходимости, замените на нужное значение
    add_field("urls.0.url", document.location.href);

    // Создаем контейнер для кнопок и вставляем его в блок .d-generic-page-head__main-actions
    buttons = document.createElement("div");
    buttons.classList.add("button-content");
    buttons.style.display = "flex";
    buttons.style.flexDirection = "row";
    buttons.style.gap = "10px";
    buttons.style.alignItems = "center";
    buttons.style.marginLeft = "10px";
    myJQ(".d-generic-page-head__main-actions").append(buttons);

    // Сначала кнопка импорта, затем кнопка поиска по релизу
    addImportButton();
    addSearchButton();
  }

  // Функция для страницы исполнителя: извлекает имя исполнителя и создает кнопку поиска по исполнителю
  function extractYandexArtist() {
    var artistName = myJQ("h1.page-artist__title.typo-h1.typo-h1_big").first().text().trim();
    if (!artistName) return;

    // Создаем контейнер для кнопок, если его еще нет
    buttons = document.createElement("div");
    buttons.classList.add("button-content");
    buttons.style.display = "flex";
    buttons.style.flexDirection = "row";
    buttons.style.gap = "10px";
    buttons.style.alignItems = "center";
    buttons.style.marginLeft = "10px";
    myJQ(".d-generic-page-head__main-actions").append(buttons);

    // Добавляем кнопку поиска исполнителя
    addArtistSearchButton(artistName);
  }

  // Функция для создания кнопки поиска релиза (для альбомов) с inline-стилями
  function addSearchButton() {
    var searchLinkP = document.createElement("div");
    var searchLink = document.createElement("a");
    var searchLinkSpan = document.createElement("span");
    searchLinkSpan.textContent = "Search on MusicBrainz";
    searchLinkSpan.classList.add("btn-text");

    var searchUrl = "https://musicbrainz.org/search?query=" + encodeURIComponent(album) + "&type=release";
    searchLink.setAttribute("href", searchUrl);
    searchLink.setAttribute("target", "_blank");

    // Inline-стили для кнопки поиска (альбомов)
    searchLink.style.backgroundColor = "#ffdb4d";
    searchLink.style.borderRadius = "20px";
    searchLink.style.color = "#121212";
    searchLink.style.padding = "10px 20px";
    searchLink.style.fontSize = "15px";
    searchLink.style.textDecoration = "none";
    searchLink.style.display = "inline-block";
    searchLink.style.transition = "background-color 0.3s ease";

    searchLink.addEventListener("mouseover", function() {
      searchLink.style.backgroundColor = "#ffd435";
    });
    searchLink.addEventListener("mouseout", function() {
      searchLink.style.backgroundColor = "#ffdb4d";
    });

    searchLink.addEventListener("click", function(event) { event.stopPropagation(); });
    searchLink.appendChild(searchLinkSpan);
    searchLinkP.appendChild(searchLink);
    searchLinkP.classList.add("artLink");
    buttons.appendChild(searchLinkP);
  }

  // Функция для создания кнопки поиска исполнителя с inline-стилями
  function addArtistSearchButton(artistName) {
    var searchLinkP = document.createElement("div");
    var searchLink = document.createElement("a");
    var searchLinkSpan = document.createElement("span");
    searchLinkSpan.textContent = "Search Artist on MusicBrainz";
    searchLinkSpan.classList.add("btn-text");

    var searchUrl = "https://musicbrainz.org/search?query=" + encodeURIComponent(artistName) + "&type=artist";
    searchLink.setAttribute("href", searchUrl);
    searchLink.setAttribute("target", "_blank");

    // Inline-стили для кнопки поиска исполнителя
    searchLink.style.backgroundColor = "#ffdb4d";
    searchLink.style.borderRadius = "20px";
    searchLink.style.color = "#121212";
    searchLink.style.padding = "10px 20px";
    searchLink.style.fontSize = "15px";
    searchLink.style.textDecoration = "none";
    searchLink.style.display = "inline-block";
    searchLink.style.transition = "background-color 0.3s ease";

    searchLink.addEventListener("mouseover", function() {
      searchLink.style.backgroundColor = "#ffd435";
    });
    searchLink.addEventListener("mouseout", function() {
      searchLink.style.backgroundColor = "#ffdb4d";
    });

    searchLink.addEventListener("click", function(event) { event.stopPropagation(); });
    searchLink.appendChild(searchLinkSpan);
    searchLinkP.appendChild(searchLink);
    searchLinkP.classList.add("artLink");
    buttons.appendChild(searchLinkP);
  }

  // Функция для создания кнопки импорта с inline-стилями
  function addImportButton() {
    myform.method = "post";
    myform.target = "_blank";
    myform.action = document.location.protocol + "//musicbrainz.org/release/add";
    myform.acceptCharset = "UTF-8";
    var mysubmit = document.createElement("input");
    mysubmit.type = "submit";
    mysubmit.value = "Add to MusicBrainz";

    // Inline-стили для кнопки импорта
    mysubmit.style.backgroundColor = "#ffdb4d";
    mysubmit.style.borderRadius = "20px";
    mysubmit.style.color = "#121212";
    mysubmit.style.border = "none";
    mysubmit.style.padding = "10px 20px";
    mysubmit.style.fontSize = "15px";
    mysubmit.style.cursor = "pointer";
    mysubmit.style.transition = "background-color 0.3s ease";

    mysubmit.addEventListener("mouseover", function() {
      mysubmit.style.backgroundColor = "#ffd435";
    });
    mysubmit.addEventListener("mouseout", function() {
      mysubmit.style.backgroundColor = "#ffdb4d";
    });

    mysubmit.classList.add("mbBtn", "play-button", "action-button", "typography-label-emphasized");
    myform.appendChild(mysubmit);
    var div = document.createElement("div");
    div.classList.add("mbForm");
    div.appendChild(myform);
    buttons.appendChild(div);
  }

  function parseDuration(durationStr) {
    var parts = durationStr.split(":");
    if (parts.length !== 2) return 0;
    var minutes = parseInt(parts[0], 10);
    var seconds = parseInt(parts[1], 10);
    return ((minutes * 60) + seconds) * 1000;
  }

  function add_field(name, value) {
    var field = document.createElement("input");
    field.type = "hidden";
    field.name = name;
    field.value = value;
    myform.appendChild(field);
  }
})();
