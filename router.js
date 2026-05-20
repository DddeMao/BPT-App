const routes = {
    'home': {
        title: 'Главная',
        init: () => {
            document.getElementById('content').innerHTML = `<h2>Новинки</h2><div id="feed" class="grid-container"></div>`;
            renderFeed();
        }
    },
    'albums': {
        title: 'Альбомы',
        init: () => {
            document.getElementById('content').innerHTML = `<h2>Альбомы</h2><div id="album-grid" class="album-grid"></div>`;
            renderAlbums();
        }
    }
};

function navigate(page) {
    const content = document.getElementById('content');
    if (!routes[page]) return;

    content.style.opacity = 0;
    setTimeout(() => {
        routes[page].init();
        content.style.opacity = 1;
    }, 200);
}