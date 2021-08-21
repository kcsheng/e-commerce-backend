const router = require("express").Router();
const { Product, Category, Tag, ProductTag } = require("../../models");

router.get("/", async (req, res) => {
  try {
    const allProducts = await Product.findAll({
      include: [{ model: Category }, { model: Tag }],
    });
    res.status(200).json(allProducts);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const productById = await Product.findByPk(id, {
      include: [{ model: Category }, { model: Tag }],
    });
    if (!productById) {
      res.status(404).json({ message: "No product with this id!" });
      return;
    }
    res.status(200).json(productById);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/", async (req, res) => {
  /* req.body should look like this...
    {
      product_name: "Basketball",
      price: 200.00,
      stock: 3,
      category_id: 2,
      tagIds: [1, 2, 3, 4]
    }
  */
  try {
    const newProduct = await Product.create(req.body);
    // Generate one or other response based on tagIds array empty or not
    if (req.body.tagIds.length) {
      // If tagIds is not empty, first map out the corresponding objects for ProductTag
      const productTagIdArr = await req.body.tagIds.map((tag_id) => {
        return {
          product_id: newProduct.id,
          tag_id,
        };
      });
      // then populate all instances in the ProductTag table
      const productTagIds = await ProductTag.bulkCreate(productTagIdArr, {
        returning: true,
      });
      res.status(200).json(productTagIds);
    } else {
      // if tagIds is empty like so [], just respond
      res.status(200).json(newProduct);
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
// Can take modified tagIds and change the associations
router.put("/:id", (req, res) => {
  Product.update(req.body, {
    where: { id: req.params.id },
  })
    .then((product) => {
      // find all associated tags from ProductTag
      return ProductTag.findAll({ where: { product_id: req.params.id } });
    })
    .then((productTags) => {
      // get list of current tag_ids
      const productTagIds = productTags.map(({ tag_id }) => tag_id);
      // find out tag_ids that do not pre-exist in the ProductTag and make them instances with product id
      const newProductTags = req.body.tagIds
        .filter((tag_id) => !productTagIds.includes(tag_id))
        .map((tag_id) => {
          return {
            product_id: req.params.id,
            tag_id,
          };
        });
      // find out which tag_ids that are not associated with the product any more
      const productTagsToRemoveByIds = productTags
        .filter(({ tag_id }) => !req.body.tagIds.includes(tag_id))
        .map(({ id }) => id);

      // run both actions
      return Promise.all([
        ProductTag.destroy({ where: { id: productTagsToRemoveByIds } }),
        ProductTag.bulkCreate(newProductTags),
      ]);
    })
    .then((updatedProductTags) => res.json(updatedProductTags))
    .catch((err) => {
      res.status(400).json(err);
    });
});

router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.destroy({
      where: { id: req.params.id },
    });
    if (!deletedProduct) {
      res.status(404).json({ message: "No product with that id!" });
      return;
    }
    res.status(200).json(deletedProduct);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
