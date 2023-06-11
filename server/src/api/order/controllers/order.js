'use strict';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

/**
 * order controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    const { products, userName, email } = ctx.request.body;

    try {
      const lineItems = await Promise.all(products.map(async (product) => {
        try {
          // retrieve item information
          const item = await strapi.service("api::item.item").findOne(product.id);
          return {
            price_data: {
              currency: "inr",
              product_data: {
                name: item.name
              },
              unit_amount: item.price * 100,
            },
            quantity: product.count,
          }
        } catch (error) {
          console.error("Error while fetching product details: ", product.id);
          console.error(error);
          ctx.response.status = 500;
          return { error: { message: "There was a problem creating the charge" } };
        }
      }));
      strapi.log.info(lineItems)

      // create a stripe session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: email,
        mode: "payment",
        success_url: "http://localhost:3000/checkout/success",
        cancel_url: "http://localhost:3000/",
        line_items: lineItems,
      });

      // create the item
      await strapi
        .service("api::order.order")
        .create({ data: { userName, products, stripeSessionId: session.id } });

      // return the session id
      return { id: session.id };
    } catch (error) {
      strapi.log.debug(error);
      ctx.response.status = 500;
      return { error: { message: "There was a problem creating the charge" } };
    }
  }
}));
