jQuery(document).ready(function ($) {
  var hotListFetch = $.ajax({ url: API_URL + 'wp/v2/posts?_embed&categories=8', dataType: 'json' }); // c?¡Óe?€a??c??
  var videoListFetch = $.ajax({ url: API_URL + 'wp/v2/posts?_embed&categories=6', dataType: 'json' }); // a?¡Óe?3a¢X?a?€
  $.when(hotListFetch, videoListFetch).done(function (hotListData, videoListData) {
    var hotList = hotListData[0];
    var videoList = videoListData[0];

    // c?¡Óe?€a??c??
    [0, 1, 2].forEach(function (i) {
      var post = hotList[i];
      if (hotList) {
        // console.log(post);
        var media = post._embedded['wp:featuredmedia'] ? post._embedded['wp:featuredmedia'][0] : null;
        var srcUrl = media ? media.source_url : '';
        var newsTmp = $('[tmp-news-list]').clone().removeAttr('tmp-news-list').removeClass('d-none');
        newsTmp.attr('href', 'articles/' + post.id + '/' + post.categories[0]).attr('data-label', post.title.rendered);
        newsTmp.find('.hot-post-box__body-title').html(post.title.rendered);
        newsTmp.find('.hot-post-box__body-body').html(post.excerpt.rendered);
        newsTmp.find('.hot-post-box__body-date').html(post.date.slice(0, 10));
        newsTmp.find('.hot-post-box__img img').attr('src', srcUrl);
        $('[content-hot-list]').append(newsTmp);
      }
    });
  });
});
