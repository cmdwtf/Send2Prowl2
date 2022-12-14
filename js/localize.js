/*

MIT License

Copyright (c) 2021 by Chris Marc Dailey (nitz) <https://cmd.wtf>
Copyright (c) 2019 Joshua Butt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

'use-strict';

function toI18n(str) {
    return str.replace(/__MSG_(\w+)__/g, function (match, v1) {
        return v1 ? browser.i18n.getMessage(v1) : '';
    });
}

function localizeObject(obj, tag) {
    var msg = toI18n(tag);
    if (msg != tag) obj.innerHTML = DOMPurify.sanitize(msg);
}

function localizeHtmlPage() {
    var data = document.querySelectorAll('[data-localize]');

    for (var i = 0; i < data.length; i++) {
        var obj = data[i];
        var tag = obj.getAttribute('data-localize').toString();

        localizeObject(obj, tag);
    }
}

localizeHtmlPage();
