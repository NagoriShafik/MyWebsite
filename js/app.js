var preloader = document.getElementById('loading');
function lodinglogo() {
  preloader.style.display = "none";
}

$(document).ready(function () {

  $("#hamburger").click(function noscroll() {
      if (this.click) {
        $(".topsection").slideToggle();
        $("body").addClass("position");
        

      } else {
        $("body").removeClass("position");             
        
    }
  });
    
        
});

$(".cross").click(function () {
    $(".topsection").slideUp();
    $("body").removeClass("position");
});
$(".x").click(function () {
  $(".topsection").slideUp();
  $("body").removeClass("position");
});
