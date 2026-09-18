const o=/^>>Q:(\d+)\r?\n?/;function t(e,n){return`>>Q:${n}
${e}`}function r(e){const n=o.exec(e);return n?{text:e.slice(n[0].length),quoteId:Number(n[1])}:{text:e}}export{r as decodeQuote,t as encodeQuote};
