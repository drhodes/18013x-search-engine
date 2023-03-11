function log(msg) {
  console.log(["[searchx] ", msg]);
}

class Trie {
  constructor(trie_data) {
    this.trie_data = trie_data;    
    log("Trie constructed: " + trie_data);
  }
  
  lookup(term) {
    var cur = this.trie_data;
    var prev = cur;
    for (var i=0; i<term.length; i++) {
      //console.log(Object.keys(cur.nodes));
      if (cur.nodes[term[i]]) {
        // if the i_th character of term has a child      
        prev = cur;
        cur = cur.nodes[term[i]];
      } else {
        // otherwise, we got to the end of the word and ran out of
        // nodes, therefore this search term is not contained in the
        // trie.
        return [];
      }      
    }
    return cur.items;
  }
}

class SearchIndex {
  constructor(baseStaticURL) {
    this.trie = {};
    this.page_table = [];

    // for openedx this needs to be a relative link.
    // fetch("./asset-v1:MITx+18.02+T12022+type@asset+block@search-index.json")
    fetch("search-index.json")
      .then(response => response.json())
      .then(json => {
        log("finished loading search index");
        
        // TODO fix this in the generator.
        this.trie = new Trie(JSON.parse(json.trie));
        this.page_table = json.page_table; //JSON.parse(json.page_table);
        for (var i=0; i<this.page_table.length; i++) {
          // TODO this is awful, need to fix in python json encoder.
          this.page_table[i] = JSON.parse(json.page_table[i]);
        }
      });
  }

  search(term) {
    return this.trie.lookup(term);
  }
}

class Search {
  constructor() {
    // look for the index, this should be cached in the browser.
    // consider dropping it local storage?
    this.index = new SearchIndex();
    this.element_buffer = [];
  }

  // clear out the search results.
  clear() {
    this.element_buffer = [];
    let div = document.getElementById("search-results");
    
    while (div.firstChild) {
      div.removeChild(div.firstChild);
    }
  }
  
  doOneSearch(term) {
    log("searching: " + term);
    
    if (term.length > 2) { 
      let pageids = this.index.search(term);
      return pageids;
    } else {
      return [];
    }
  }

  doSearch() {
    function intersection(xs1, xs2) {
      // modified intersection. don't allow empty sets to wipe out all results
      if (xs1.length == 0) return xs2;
      if (xs2.length == 0) return xs1;
      
      // https://www.techiedelight.com/find-intersection-arrays-javascript/
      return xs1.filter(x => xs2.indexOf(x) !== -1);
    }
    
    var terms = this.getSearchTerms("search-field");
    terms = terms.trim().split(/\s+/);
    
    let pageids1 = []; 
    
    for (var i=0; i<terms.length; i++) {
      let term = terms[i];

      // don't consider words with less than three characters.
      console.log([term, term.length]);
      if (term.length < 3) continue;
      
      let pageids2 = this.doOneSearch(term);
      pageids1 = intersection(pageids1, pageids2);
    }
    
    this.showResults(pageids1, terms[0]);
    this.updateResultCount(pageids1.length);
  }

  updateResultCount(n) { 
    // let div = document.getElementById("num-results");
   
  }
  
  showResults(pageids, terms) {
    for(let pageid of pageids) {
      this.addOneResult(pageid, terms);
    }
  }

  getPage(pageid) {
    let page = this.index.page_table[pageid];
    return page;
  }

  cleanupText(text) {
    text = text.replaceAll("[mathjaxinline]", "");
    text = text.replaceAll("[mathjax]", "");
    text = text.replaceAll("[//mathjax]", "");
    text = text.replaceAll("[/mathjaxinline]", "");
    text = text.replaceAll("\\displaystyle", "");
    text = text.replaceAll("\\,", "");
    text = text.replaceAll("\\", "");
    text = text.replaceAll("---|---", "");
    text = text.replaceAll("---", "");
    text = text.replaceAll("| |", "");
    text = text.replaceAll("||", "");
    text = text.replaceAll("|", "");
    text = text.replaceAll("**", "");
    return text;
  }
  
  buildSnippet(page, terms) {   
    let snippet = document.createElement("div");
    snippet.className = "searchx-snippet";

    let text = this.cleanupText(page.text);
    
    let parts = text.split(terms);
    let N = 80; // the amount of context to the left and right
    
    for (var i=0; i<parts.length-1; i++) {      
      let leftTxt = parts[i];
      let rightTxt = parts[i+1];
      
      let leftSpan = document.createElement("span"); 
      let leftNode = document.createTextNode(leftTxt.substring(leftTxt.length - N));
      leftSpan.appendChild(leftNode);
 
      let termSpan = document.createElement("span"); 
      let termNode = document.createTextNode(terms);
      termSpan.className = "searchx-boldspan";
      termSpan.appendChild(termNode);

      let rightSpan = document.createElement("span"); 
      let rightNode = document.createTextNode(rightTxt.substring(0, N) + " … ");
      rightSpan.appendChild(rightNode);

      snippet.appendChild(leftSpan);
      snippet.appendChild(termSpan);
      snippet.appendChild(rightSpan);
    }
    
    return snippet;
  }
  
  buildUrl(page) {
    let url = document.createElement("div");
    url.className = "searchx-url";
    var a = document.createElement('a');
    var txt = document.createTextNode(page.title);
    a.appendChild(txt);

    a.onclick = function() {
      window.open(page.url, '_blank').focus();
    };
    
    url.appendChild(a);
    return url;
  }
  
  addOneResult(pageid, terms) {
    let page = this.getPage(pageid);
    let div = document.getElementById("search-results");
    let child = document.createElement("div");
    let urlnode = this.buildUrl(page);
    child.appendChild(urlnode);
    let txtnode = this.buildSnippet(page, terms);
    child.appendChild(txtnode);
    div.appendChild(child);
  }
  
  getSearchTerms(element_id) {
    let el = document.getElementById(element_id);
    return el.value.toLowerCase();
  }
  
  addListener(element_id) {
    let el = document.getElementById(element_id);
    el.addEventListener("keyup", (event) => {
      //log("keyup: " + this.getSearchTerms(element_id));
      this.clear();
      this.doSearch();
    });

    el.addEventListener("keydown", (event) => {
      // Ignore keypress if all fields are not populated.
      if (event.which === 13) {
        return false;
      }
      return true;
    });
  }
}

// this global state is ok, encapsulate when needed.
let search = new Search();
search.addListener("search-field");