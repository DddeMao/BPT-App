const routes = {
    'home': {
        title: 'Главная',
        init: () => {
            document.getElementById('content').innerHTML = `<div id="feed" class="grid-container"></div>`;
            if (typeof showSongsView === 'function') showSongsView();
        }
    },
    'albums': {
        title: 'Альбомы',
        init: () => {
            document.getElementById('content').innerHTML = `<div id="album-grid" class="album-grid"></div>`;
            if (typeof showAlbumsView === 'function') showAlbumsView();
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
