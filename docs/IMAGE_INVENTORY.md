# Supplied image inventory

All eight owner-supplied PNGs were visually inspected. Originals are preserved byte-for-byte in `assets/originals/`, outside the public deployment directory. Windows Zone.Identifier sidecars are excluded. SHA-256 values are recorded in `scripts/brand-image-sources.json` and checked by the optimisation script. Photo provenance, date and exact location have not been independently authenticated; neither the filenames nor clothing establish professional credentials.

| Original filename                                                       | Published slug       | Placement                                                                   |
| ----------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| Dr David in Hospital.png                                                | `founder-laboratory` | Homepage and About founder portraits (laboratory background)                |
| Dr David in the garden.png                                              | `founder-garden`     | Homepage and About founder portraits; Gardens gallery and consultation card |
| Wheatgrass.png                                                          | `wheatgrass`         | Homepage gardens card; Gardens wheatgrass section                           |
| Moringa oleifera seedlings.png                                          | `moringa-seedlings`  | Homepage seedlings card; Gardens gallery; moringa seedling detail/catalogue |
| Rosemary seedlings.png                                                  | `rosemary-seedlings` | Gardens gallery and practical-learning card                                 |
| Packaged herbs.png                                                      | `packaged-herbs`     | Homepage products card; Products catalogue contextual photograph            |
| Establishment of kitchen gardens and agro ecological gardensfarms.png   | `garden-plants`      | Homepage garden story; Gardens gallery                                      |
| Establishment of kitchen gardens and agro ecological gardensfarms 2.png | `garden-growing`     | Homepage hero; Gardens overview and visit card; social previews             |

24 WebP derivatives total 3,305,640 bytes. Width targets: 480, 800 and 1200 pixels, without enlargement; actual widths and heights populate responsive srcsets and intrinsic dimensions. Quality is 82. Founder editorial portraits retain their full frame. Environmental hero images and card thumbnails use CSS object-fit; the garden gallery founder image uses contain to retain the person and notebook. Below-fold photographs load lazily; hero photographs load eagerly.

`npm run images:optimize` regenerates public derivatives and `src/config/brand-images.json`. No new imagery was generated. Existing illustrative stock images remain for catalogue items without matching supplied photographs. Powdered moringa jars are not substituted for moringa leaf tea. Wheatgrass is shown as cultivation with enquiry-only availability.
