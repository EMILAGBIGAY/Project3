const selectEl = document.getElementById("colorblind-select");

selectEl.addEventListener("change", function() {
  const filter = this.value;
  document.documentElement.className = filter;
});
