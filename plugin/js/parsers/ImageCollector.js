/*
    Fetches the image files
*/

"use strict";

/*
    Details of an image in BakaTsuki web page
    imagePageUrl :  URL of web page that holds list of versions of the image
    sourceImageUrl : URL of thumbnail image jpeg/png/bmp file in source web page
    zipHref:  relative path + filename used to store file in the EPUB (zip) file.
    id: the id value in the content.opf file
    mediaType: jpeg, png, etc.
    arrayBuffer: the image bytes
    isCover :  use this as the cover image?
    height: "full size" image height 
    width: "full size" image width
    imagefileUrl: URL of "full size" image file at Baka-Tsuki
*/
function ImageInfo(imagePageUrl, imageIndex, sourceImageUrl) {
    // ToDo:  This will need to derive from EpubItem
    let that = this;
    this.imagePageUrl = imagePageUrl;
    this.sourceImageUrl = sourceImageUrl;
    let suffix = that.findImageType(imagePageUrl);
    this.zipHref = that.makeZipHref(imageIndex, suffix, imagePageUrl);
    this.id = that.makeId(imageIndex);
    this.mediaType = that.makeMediaType(suffix);
    this.imageIndex = imageIndex;
    this.isCover = false;
    this.isInSpine = false;
    this.isOutsideGallery = false;
    this.arraybuffer = null;
    this.height = null;
    this.width = null;
    this.imagefileUrl = null
}

ImageInfo.prototype.findImageType = function (imagePageUrl) {
    // assume the image Page URL looks something like this:
    // http://www.baka-tsuki.org/project/index.php?title=File:WebToEpub.jpg
    let index = imagePageUrl.lastIndexOf(".");
    let suffix = imagePageUrl.substring(index + 1, imagePageUrl.length);
    return suffix;
}

ImageInfo.prototype.makeZipHref = function (imageIndex, suffix, imagePageUrl) {
    let that = this;
    return util.makeStorageFileName("OEBPS/Images/", imageIndex, that.getImageName(imagePageUrl), suffix);
}

ImageInfo.prototype.getImageName = function (page) {
    if(page){
        var name = page.split(/\//gi).length > 1 ? page.split(/file:/gi)[1] : page;
        if(name){
            return name.split(/\./gi)[0];
        }
    }
    // This is actually wise to do now.
    return undefined;
}

ImageInfo.prototype.makeId = function (imageIndex) {
    return "image" + util.zeroPad(imageIndex);
}

ImageInfo.prototype.makeMediaType = function (suffix) {
    switch(suffix.toUpperCase()) {
        case "PNG":
            return "image/png";
        case "JPG":
        case "JPEG":
            return "image/jpeg";
        case "GIF":
            return "image/gif";
        default:
            alert("Unknown media type:" + suffix);
            return "image/" + suffix;
    };
}

ImageInfo.prototype.getZipHref = function () {
    return this.zipHref;
}

ImageInfo.prototype.getId = function () {
    return this.id;
}

ImageInfo.prototype.getMediaType = function () {
    return this.mediaType;
}

ImageInfo.prototype.fileContentForEpub = function() {
    return this.arraybuffer;
}

ImageInfo.prototype.createImageElement = function() {
    let that = this;
    return util.createSvgImageElement(that.getZipHref(), that.width, that.height, that.imagePageUrl);
}

function ImageCollector() {
    this.removeDuplicateImages = false;
}

// get URL of page that holds all copies of this image
ImageCollector.prototype.extractImagePageUrl = function (element) {
    return (element.tagName === "A") ? element.href : element.getElementsByTagName("a")[0].href;
}

// get src value of <img> element
ImageCollector.prototype.extractImageSrc = function (element) {
    return element.getElementsByTagName("img")[0].src;
}

function ImageElementConverter(element, imagePageUrl, removeDuplicateImages) {
    this.element = element;
    this.imagePageUrl = imagePageUrl;
    this.removeDuplicateImages = removeDuplicateImages;
}

ImageElementConverter.prototype.replaceWithImagePageUrl = function (images) {
    let that = this;
    // replace tag with nested <img> tag, with new <img> tag
    let imageInfo = images.get(that.imagePageUrl);
    if (imageInfo != null && that.element.parentElement != null) {
        let newImage = imageInfo.createImageElement();
        if (that.isDuplicateImageToRemove(imageInfo)) {
            util.removeNode(that.element)
        }else{
            that.element.parentElement.replaceChild(newImage, that.element);
        }
    }
}

ImageElementConverter.prototype.isDuplicateImageToRemove = function (imageInfo) {
    let that = this;
    return that.removeDuplicateImages && that.isElementInImageGallery() && (imageInfo.isOutsideGallery || imageInfo.isCover);
}

ImageElementConverter.prototype.isElementInImageGallery = function () {
    return (this.element.className === "thumb");
}

ImageCollector.prototype.makeImageConverter = function (element) {
    let that = this;
    let wrappingElement = that.findImageWrappingElement(element);
    let imagePageUrl = that.extractImagePageUrl(wrappingElement);
    return (imagePageUrl === null) ? null : new ImageElementConverter(wrappingElement, imagePageUrl, that.removeDuplicateImages);
}

ImageCollector.prototype.findImageWrappingElement = function (element) {
    let that = this;

    // find "highest" element that is wrapping an image element
    let parent = element.parentElement;
    while (parent != null) {
        if (that.isImageWrapperElement(parent)) {
            return parent;
        }
        parent = parent.parentElement;
    }

    // assume all images are wrapped in at least a href
    return element.parentElement;
}

ImageCollector.prototype.isImageWrapperElement = function (element) {
    return ((element.tagName === "DIV") &&
        ((element.className === "thumb tright") || (element.className === "floatright") ||
        (element.className === "thumb")));
}

ImageCollector.prototype.findImagesUsedInDocument = function (content) {
    let that = this;
    let images = new Map();
    for(let currentNode of util.getElements(content, "img")) {
        let converter = that.makeImageConverter(currentNode)
        if (converter != null) {
            let src = that.extractImageSrc(converter.element);
            let pageUrl = converter.imagePageUrl;
            let existing = images.get(pageUrl);
            if(existing == null){
                images.set(pageUrl, new ImageInfo(pageUrl, images.size, src));
            } else {
                existing.isOutsideGallery = true;
            }
        }
    };
    return images;
}

ImageCollector.prototype.populateImageTable = function (images, bakaTsukiParser) {
    let that = this;
    let imagesTable = document.getElementById("imagesTable");
    while (imagesTable.children.length > 1) {
        imagesTable.removeChild(imagesTable.children[imagesTable.children.length - 1])
    }
    let checkBoxIndex = 0;
    if (0 === images.size) {
        imagesTable.parentElement.appendChild(document.createTextNode("No images found"));
    }
    else {
        images.forEach(function (imageInfo) {
            let row = document.createElement("tr");
        
            // add checkbox
            let checkbox = that.createCheckBoxAndLabel(imageInfo, checkBoxIndex, bakaTsukiParser);
            that.appendColumnToRow(row, checkbox);

            // add image
            let img = document.createElement("img");
            img.setAttribute("style", "max-height: 120px; width: auto; ");
            img.src = imageInfo.sourceImageUrl;
            that.appendColumnToRow(row, img);
            imagesTable.appendChild(row);

            ++checkBoxIndex;
        });
    }

}

ImageCollector.prototype.createCheckBoxAndLabel = function (imageInfo, checkBoxIndex, bakaTsukiParser) {
    let that = this;
    let label = document.createElement("label");
    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "setCoverCheckBox" + checkBoxIndex;
    checkbox.onclick = function() { that.onImageClicked(checkbox.id, imageInfo, bakaTsukiParser); };
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("Set Cover"));

    // default to first image as cover image
    if (checkBoxIndex === 0) {
        bakaTsukiParser.setCoverImage(imageInfo);
        checkbox.checked = true;
    }
    return label;
}

ImageCollector.prototype.onImageClicked = function(checkboxId, imageInfo, bakaTsukiParser) {
    let checkbox = document.getElementById(checkboxId);
    if (checkbox.checked === true) {
        bakaTsukiParser.setCoverImage(imageInfo);

        // uncheck any other checked boxes
        let imagesTable = document.getElementById("imagesTable");
        for(let box of util.getElements(imagesTable, "input")) {
            if (box.id !== checkboxId) {
                box.checked = false;
            }
        }
    } else {
        bakaTsukiParser.setCoverImage(null);
    }
} 

ImageCollector.prototype.appendColumnToRow = function (row, element) {
    let col = document.createElement("td");
    col.appendChild(element);
    col.style.whiteSpace = "nowrap";
    row.appendChild(col);
    return col;
}

ImageCollector.prototype.fetchImages = function (imageList, progressIndicator) {
    let that = this;
    let client = new HttpClient();
    var sequence = Promise.resolve();
    imageList.forEach(function(imageInfo) {
        sequence = sequence.then(function () {
            return client.fetchHtml(imageInfo.imagePageUrl);
        }).then(function (rawDom) {
            imageInfo.imagefileUrl = that.getHighestResImageUrlFromImagePage(rawDom);
            return that.updateImageInfoFromImagePage(imageInfo);
        }).then(function () {
            return client.fetchBinary(imageInfo.imagefileUrl);
        }).then(function (arraybuffer) {
            imageInfo.arraybuffer = arraybuffer;
            progressIndicator();
        })
    });
    return sequence;
}

ImageCollector.prototype.getHighestResImageUrlFromImagePage = function(dom) {
    let div = util.getElement(dom, "div", e => (e.className === "fullMedia"));
    return util.getElement(div, "a").href;
}

ImageCollector.prototype.getReducedResImageUrlFromImagePage = function(dom) {
    let div = util.getElement(dom, "div", e => (e.className === "fullImageLink"));
    return util.getElement(div, "img").src;
}

ImageCollector.prototype.updateImageInfoFromImagePage = function(imageInfo) {
    return new Promise(function(resolve, reject){
        let img = new Image();
        img.onload = function() {
            imageInfo.height = img.height;
            imageInfo.width = img.width;
            resolve();
        }
        img.onerror = function(){
            // If the image gives an error then set a general height and width
            imageInfo.height = 1200;
            imageInfo.width = 1600;
            resolve();
        }
        // start downloading image after event handlers are set
        img.src = imageInfo.imagefileUrl;
    });
}
