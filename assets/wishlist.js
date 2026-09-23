(() => {
  'use strict';

  const STORAGE_KEY = 'boutiqueWishlist:v1';
  const MAX_ITEMS = 50;

  const ShopifyRoot =
    window.Shopify &&
    window.Shopify.routes &&
    window.Shopify.routes.root
      ? window.Shopify.routes.root
      : '/';


  function readWishlist() {
    try {
      const stored =
        JSON.parse(
          window.localStorage.getItem(STORAGE_KEY) || '[]'
        );

      if (!Array.isArray(stored)) {
        return [];
      }

      return stored
        .filter((handle) => typeof handle === 'string' && handle)
        .slice(0, MAX_ITEMS);

    } catch (error) {
      return [];
    }
  }


  function writeWishlist(handles) {
    const cleanHandles =
      [...new Set(handles)]
        .filter(Boolean)
        .slice(0, MAX_ITEMS);

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cleanHandles)
      );
    } catch (error) {
      return;
    }

    syncWishlistUI();

    document.dispatchEvent(
      new CustomEvent('boutique:wishlist:update', {
        detail: {
          handles: cleanHandles
        }
      })
    );
  }


  function hasProduct(handle) {
    return readWishlist().includes(handle);
  }


  function toggleProduct(handle) {
    if (!handle) return;

    const handles =
      readWishlist();

    const index =
      handles.indexOf(handle);

    if (index >= 0) {
      handles.splice(index, 1);
    } else {
      handles.unshift(handle);
    }

    writeWishlist(handles);
  }


  function syncWishlistUI() {
    const handles =
      readWishlist();

    document
      .querySelectorAll('[data-wishlist-toggle]')
      .forEach((button) => {
        const handle =
          button.dataset.productHandle;

        const title =
          button.dataset.productTitle ||
          'this product';

        const active =
          handles.includes(handle);

        button.classList.toggle(
          'is-active',
          active
        );

        button.setAttribute(
          'aria-pressed',
          active ? 'true' : 'false'
        );

        button.setAttribute(
          'aria-label',
          active
            ? `Remove ${title} from wishlist`
            : `Add ${title} to wishlist`
        );

        const text =
          button.querySelector(
            '[data-wishlist-button-text]'
          );

        if (text) {
          text.textContent =
            active
              ? 'REMOVE FROM WISHLIST'
              : 'ADD TO WISHLIST';
        }
      });


    document
      .querySelectorAll('[data-wishlist-count]')
      .forEach((count) => {
        count.textContent =
          String(handles.length);

        count.hidden =
          handles.length === 0;
      });


    document
      .querySelectorAll('[data-wishlist-link]')
      .forEach((link) => {
        link.setAttribute(
          'aria-label',
          handles.length
            ? `Wishlist, ${handles.length} item${handles.length === 1 ? '' : 's'}`
            : 'Wishlist'
        );
      });
  }


  function formatMoney(cents, currency) {
    const value =
      Number(cents || 0) / 100;

    try {
      return new Intl.NumberFormat(
        document.documentElement.lang || 'en',
        {
          style: 'currency',
          currency: currency || 'USD'
        }
      ).format(value);
    } catch (error) {
      return value.toFixed(2);
    }
  }


  async function fetchProduct(handle) {
    const response =
      await fetch(
        `${ShopifyRoot}products/${encodeURIComponent(handle)}.js`,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `Unable to load ${handle}`
      );
    }

    return response.json();
  }


  function createWishlistCard(product, currency) {
    const article =
      document.createElement('article');

    article.className =
      'boutique-wishlist-card';


    const media =
      document.createElement('a');

    media.className =
      'boutique-wishlist-card__media';

    media.href =
      product.url ||
      `${ShopifyRoot}products/${product.handle}`;


    const featuredImage =
      typeof product.featured_image === 'string'
        ? product.featured_image
        : product.featured_image &&
          product.featured_image.src
          ? product.featured_image.src
          : null;


    if (featuredImage) {
      const image =
        document.createElement('img');

      image.src =
        featuredImage;

      image.alt =
        product.title || '';

      image.loading =
        'lazy';

      media.appendChild(image);
    }


    article.appendChild(media);


    const information =
      document.createElement('div');

    information.className =
      'boutique-wishlist-card__info';


    const title =
      document.createElement('a');

    title.className =
      'boutique-wishlist-card__title';

    title.href =
      media.href;

    title.textContent =
      product.title || 'Product';

    information.appendChild(title);


    const price =
      document.createElement('div');

    price.className =
      'boutique-wishlist-card__price';

    price.textContent =
      formatMoney(
        product.price,
        currency
      );

    information.appendChild(price);


    const actions =
      document.createElement('div');

    actions.className =
      'boutique-wishlist-card__actions';


    const availableVariant =
      Array.isArray(product.variants)
        ? product.variants.find(
            (variant) => variant.available
          )
        : null;


    const addButton =
      document.createElement('button');

    addButton.type =
      'button';

    addButton.className =
      'boutique-wishlist-card__add';

    addButton.textContent =
      availableVariant
        ? 'ADD TO CART'
        : 'SOLD OUT';

    if (availableVariant) {
      addButton.dataset.wishlistAddToCart =
        String(availableVariant.id);
    } else {
      addButton.disabled =
        true;
    }

    actions.appendChild(addButton);


    const removeButton =
      document.createElement('button');

    removeButton.type =
      'button';

    removeButton.className =
      'boutique-wishlist-card__remove';

    removeButton.dataset.wishlistToggle =
      '';

    removeButton.dataset.productHandle =
      product.handle;

    removeButton.dataset.productTitle =
      product.title || '';

    removeButton.setAttribute(
      'aria-pressed',
      'true'
    );

    removeButton.textContent =
      'REMOVE';

    actions.appendChild(
      removeButton
    );


    information.appendChild(
      actions
    );

    article.appendChild(
      information
    );

    return article;
  }


  async function renderWishlistPage(section) {
    if (!section) return;

    const grid =
      section.querySelector(
        '[data-wishlist-grid]'
      );

    const empty =
      section.querySelector(
        '[data-wishlist-empty]'
      );

    const loading =
      section.querySelector(
        '[data-wishlist-loading]'
      );

    if (!grid || !empty) {
      return;
    }


    const handles =
      readWishlist();

    const currency =
      section.dataset.currency || 'USD';


    grid.replaceChildren();


    if (!handles.length) {
      if (loading) {
        loading.hidden = true;
      }

      empty.hidden = false;
      grid.hidden = true;

      return;
    }


    empty.hidden = true;
    grid.hidden = true;

    if (loading) {
      loading.hidden = false;
    }


    const results =
      await Promise.allSettled(
        handles.map(fetchProduct)
      );


    const products =
      results
        .filter(
          (result) =>
            result.status === 'fulfilled'
        )
        .map(
          (result) =>
            result.value
        );


    if (loading) {
      loading.hidden = true;
    }


    if (!products.length) {
      empty.hidden = false;
      grid.hidden = true;
      return;
    }


    products.forEach(
      (product) => {
        grid.appendChild(
          createWishlistCard(
            product,
            currency
          )
        );
      }
    );


    grid.hidden = false;

    syncWishlistUI();
  }


  function renderAllWishlistPages() {
    document
      .querySelectorAll(
        '[data-wishlist-page]'
      )
      .forEach(
        renderWishlistPage
      );
  }


  document.addEventListener(
    'click',
    async (event) => {
      const wishlistButton =
        event.target.closest(
          '[data-wishlist-toggle]'
        );

      if (wishlistButton) {
        event.preventDefault();

        toggleProduct(
          wishlistButton.dataset.productHandle
        );

        return;
      }


      const addButton =
        event.target.closest(
          '[data-wishlist-add-to-cart]'
        );

      if (!addButton) {
        return;
      }


      event.preventDefault();

      const variantId =
        Number(
          addButton.dataset.wishlistAddToCart
        );

      if (!variantId) {
        return;
      }


      addButton.disabled = true;
      addButton.textContent =
        'ADDING...';


      try {
        const response =
          await fetch(
            `${ShopifyRoot}cart/add.js`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
                Accept:
                  'application/json'
              },
              body: JSON.stringify({
                items: [
                  {
                    id: variantId,
                    quantity: 1
                  }
                ]
              })
            }
          );


        if (!response.ok) {
          throw new Error(
            'Unable to add product'
          );
        }


        addButton.textContent =
          'ADDED TO CART';


        document.dispatchEvent(
          new CustomEvent(
            'boutique:cart:updated'
          )
        );


      } catch (error) {

        addButton.disabled = false;

        addButton.textContent =
          'TRY AGAIN';

      }
    }
  );


  document.addEventListener(
    'boutique:wishlist:update',
    () => {
      renderAllWishlistPages();
    }
  );


  document.addEventListener(
    'shopify:section:load',
    () => {
      syncWishlistUI();
      renderAllWishlistPages();
    }
  );


  window.addEventListener(
    'storage',
    (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      syncWishlistUI();
      renderAllWishlistPages();
    }
  );


  function boot() {
    syncWishlistUI();
    renderAllWishlistPages();
  }


  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      boot,
      { once: true }
    );
  } else {
    boot();
  }

})();


/* Boutique cart count sync */
(function () {
  if (window.__boutiqueCartCountSyncBound) return;

  window.__boutiqueCartCountSyncBound = true;

  async function syncBoutiqueCartCount() {
    try {
      const root =
        window.Shopify &&
        window.Shopify.routes &&
        window.Shopify.routes.root
          ? window.Shopify.routes.root
          : '/';

      const response = await fetch(`${root}cart.js`, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) return;

      const cart = await response.json();

      const count = Number(cart.item_count || 0);

      document
        .querySelectorAll('[data-cart-count]')
        .forEach(function (element) {
          element.textContent = String(count);
          element.hidden = count === 0;
        });

      document
        .querySelectorAll('.boutique-cart')
        .forEach(function (link) {
          link.setAttribute(
            'aria-label',
            count === 1
              ? 'Cart, 1 item'
              : `Cart, ${count} items`
          );
        });

    } catch (error) {
      console.error(
        'Unable to update cart count.',
        error
      );
    }
  }

  document.addEventListener(
    'boutique:cart:updated',
    syncBoutiqueCartCount
  );
})();
