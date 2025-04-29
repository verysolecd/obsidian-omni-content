/*
 * Copyright (c) 2025 Mark Shawn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

const css = `
/* =========================================================== */
/* Obsidian的默认样式                                            */
/* =========================================================== */
.omni-content {
    padding: 20px 20px;
    user-select: text;
    -webkit-user-select: text;
    color: #222222;
    font-size: 16px;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
}

.omni-content:last-child {
    margin-bottom: 0;
}

.omni-content .fancybox-img {
    border: none;
}

.omni-content .fancybox-img:hover {
    opacity: none;
    border: none;
}

/*
=================================
Heading 
==================================
*/
.omni-content h1 {
    color: #222;
    font-weight: 700;
    font-size: 1.802em;
    line-height: 1.2;
    margin-block-start: 1em;
    margin-block-end: 0;
}

.omni-content h2 {
    color: inherit;
    font-weight: 600;
    font-size: 1.602em;
    line-height: 1.2;
    margin-block-start: 1em;
    margin-block-end: 0;
}

.omni-content h3 {
    color: inherit;
    font-weight: 600;
    font-size: 1.424em;
    line-height: 1.3;
    margin-block-start: 1em;
    margin-block-end: 0;
}

.omni-content h4 {
    color: inherit;
    font-weight: 600;
    font-size: 1.266em;
    line-height: 1.4;
    margin-block-start: 1em;
    margin-block-end: 0;
}

.omni-content h5 {
    color: inherit;
    margin-block-start: 1em;
    margin-block-end: 0;
}

.omni-content h6 {
    color: inherit;
    margin-block-start: 1em;
    margin-block-end: 0;
}

/*
=================================
Horizontal Rules
==================================
    */
.omni-content hr {
    border-color: #e0e0e0;
    margin-top: 3em;
    margin-bottom: 3em;
}

/*
=================================
Paragraphs
==================================
    */
.omni-content p {
    line-height: 1.6em;
    margin: 1em 0;
}

/*
=================================
Emphasis
==================================
    */
.omni-content strong {
    color: #222222;
    font-weight: 600;
}

.omni-content em {
    color: inherit;
    font-style: italic;
}

.omni-content s {
    color: inherit;
}

/*
=================================
    Blockquotes
==================================
    */
.omni-content blockquote {
    font-size: 1rem;
    display: block;
    margin: 2em 0;
    padding: 0em 0.8em 0em 0.8em;
    position: relative;
    color: inherit;
    border-left: 0.15rem solid #7852ee;
}

.omni-content blockquote blockquote {
    margin: 0 0;
}

.omni-content blockquote p {
    margin: 0;
}

.omni-content blockquote footer strong {
    margin-right: 0.5em;
}

/*
=================================
List
==================================
*/
.omni-content ul {
    margin: 0;
    margin-top: 1.25em;
    margin-bottom: 1.25em;
}

.omni-content ul>li {
    /* position: relative; */
    /* padding-left: 1.75rem; */
    margin-top: 0.1em;
    margin-bottom: 0.1em;
}

.omni-content ul>li::marker {
    color: #ababab;
    /* font-size: 1.5em; */
}

.omni-content li>p {
    margin: 0;
}

.omni-content ol {
    margin: 0;
    padding: 0;
    margin-top: 1.25em;
    margin-bottom: 0em;
    list-style-type: decimal;
}

.omni-content ol>li {
    position: relative;
    padding-left: 0.1em;
    margin-left: 2em;
    margin-top: 0.1em;
    margin-bottom: 0.1em;
}

/*
=================================
Link
==================================
*/
.omni-content a {
    color: #7852ee;
    text-decoration: none;
    font-weight: 500;
    text-decoration: none;
    border-bottom: 1px solid #7852ee;
    transition: border 0.3s ease-in-out;
}

.omni-content a:hover {
    color: #7952eebb;
    border-bottom: 1px solid #7952eebb;
}

/*
=================================
Table
==================================
*/
.omni-content table {
    width: 100%;
    table-layout: auto;
    text-align: left;
    margin-top: 2em;
    margin-bottom: 2em;
    font-size: 0.875em;
    line-height: 1.7142857;
    border-collapse: collapse;
    border-color: inherit;
    text-indent: 0;
}

.omni-content table thead {
    color: #000;
    font-weight: 600;
    border: #e0e0e0 1px solid;
}

.omni-content table thead th {
    vertical-align: bottom;
    padding-right: 0.5714286em;
    padding-bottom: 0.5714286em;
    padding-left: 0.5714286em;
    border: #e0e0e0 1px solid;
}

.omni-content table thead th:first-child {
    padding-left: 0.5em;
}

.omni-content table thead th:last-child {
    padding-right: 0.5em;
}

.omni-content table tbody tr {
    border-style: solid;
    border: #e0e0e0 1px solid;
}

.omni-content table tbody tr:last-child {
    border-bottom-width: 0;
}

.omni-content table tbody td {
    vertical-align: top;
    padding-top: 0.5714286em;
    padding-right: 0.5714286em;
    padding-bottom: 0.5714286em;
    padding-left: 0.5714286em;
    border: #e0e0e0 1px solid;
}

.omni-content table tbody td:first-child {
    padding-left: 0;
}

.omni-content table tbody td:last-child {
    padding-right: 0;
}

/*
=================================
Images
==================================
*/
.omni-content img {
    margin-top: 2em;
    margin-bottom: 2em;
}

.omni-content .footnotes hr {
    margin-top: 4em;
    margin-bottom: 0.5em;
}

/*
=================================
Code
==================================
*/
.omni-content .code-section {
    display: flex;
    background-color: rgb(250, 250, 250);
    border: rgb(240, 240, 240) 1px solid;
}

.omni-content .code-section ul {
    flex-shrink: 0;
    counter-reset: line;
    margin: 0;
    padding: 0.875em 0 0.875em 0.875em;
    white-space: normal;
    width: fit-content;
}

.omni-content .code-section ul>li {
    font-family: Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
    position: relative;
    margin: 0;
    padding: 0;
    display: list-item;
    text-align: right;
    line-height: 1.75em;
    font-size: 0.875em;
    padding: 0;
    list-style-type: none;
    color: rgba(0, 0, 0, 0.25);
    text-wrap: nowrap;
}

.omni-content .code-section pre {
    margin: 0;
    padding: 0;
    overflow: auto;
}

.omni-content .code-section code {
    font-family: Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace;
    color: #5c5c5c;
    background-color: #fafafa;
    font-size: 0.875em;
    vertical-align: baseline;
    padding: 0 0.5em;
}    

.omni-content .code-section pre code {
    display: block;
    text-wrap: nowrap;
    line-height: 1.75em;
    padding: 1em;
    backgroud: unset;
}
`

export default {name: '默认', className: 'obsidian-light', desc: '默认主题', author: 'SunBooshi', css:css};