// 需要渲染进inline style的css样式
export default `
/* --------------------------------------- */
/* callout */
/* --------------------------------------- */
section .ad {
  border: none;
  padding: 1em 1em 1em 1.5em;
  display: flex;
  flex-direction: column;
  margin: 1em 0;
  border-radius: 4px;
}

section .ad-title-wrap {
  display: flex;
  flex-direction: row;
  align-items: center;
  font-size: 1em;
  font-weight: 600;
}

.ad-icon {
  display: inline-block;
  width: 18px;
  height: 18px;  
}

.ad-icon svg {
  width: 100%;
  height: 100%;
}

section .ad-title {
  margin-left: 0.25em;
}

section .ad-content {
  color: rgb(34,34,34);
}

/* note info todo */
section .ad-note { 
  color: rgb(8, 109, 221);
  background-color: rgba(8, 109, 221, 0.1);
}
/* abstract tip hint */
section .ad-abstract {
  color: rgb(0, 191, 188);
  background-color: rgba(0, 191, 188, 0.1);
}
section .ad-success {
  color: rgb(8, 185, 78);
  background-color: rgba(8, 185, 78, 0.1);
}
/* question  help, faq, warning, caution, attention */
section .ad-question {
  color: rgb(236, 117, 0);
  background-color: rgba(236, 117, 0, 0.1);
}
/* failure, fail, missing, danger, error, bug */
section .ad-failure {
  color: rgb(233, 49, 71);
  background-color: rgba(233, 49, 71, 0.1);
}
section .ad-example {
  color: rgb(120, 82, 238);
  background-color: rgba(120, 82, 238, 0.1);
}
section .ad-quote {
  color: rgb(158, 158, 158);
  background-color: rgba(158, 158, 158, 0.1);
}

/* --------------------------------------- */
/* math */
/* --------------------------------------- */
.block-math-svg {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  margin:20px 0px;
  max-width: 300% !important;
}

/* --------------------------------------- */
/* 高亮 */
/* --------------------------------------- */
.note-highlight {
  background-color: rgba(255,208,0, 0.4);
}

/* --------------------------------------- */
/* 列表需要强制设置样式*/
/* --------------------------------------- */
ul {
  list-style-type: disc;
}

.note-svg-icon {
  min-width: 24px;
  height: 24px;
  display: inline-block;
}

.note-svg-icon svg {
  width: 100%;
  height: 100%;
}

.note-embed-excalidraw-left {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  width: 100%;
}

.note-embed-excalidraw-center {
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
}

.note-embed-excalidraw-right {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  width: 100%;
}

.note-embed-excalidraw {

}
`;
