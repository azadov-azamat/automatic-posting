const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');
const path = require('path');

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        request({url, encoding: null}, (err, res, body) => {
            if (err) return reject(err);
            fs.writeFile(filepath, body, err => {
                if (err) return reject(err);
                resolve(filepath);
            });
        });
    });
}

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

async function selectDropdownByIndex(page, dataCyValue, index) {
    try {
        // Dropdown tugmachasini bosish
        await page.click(`div[data-cy="${dataCyValue}"] button[data-testid="dropdown-expand-button"]`);

        try {
            await page.waitForSelector(`div[data-cy="${dataCyValue}"] ul[data-testid="dropdown-list"]`, { timeout: 10000 });
        } catch (error) {
            throw new Error(`Dropdown ro'yxati yuklanmadi: ${error.message}`);
        }

        // Dropdown ro'yxatini kutish
        // await page.waitForSelector(`div[data-cy="${dataCyValue}"] ul[data-testid="dropdown-list"]`, { timeout: 10000 });

        // Dropdown elementlarini olish
        const dropdownItems = await page.$$(`div[data-cy="${dataCyValue}"] ul[data-testid="dropdown-list"] li`);
        console.log("dropdownItems", dropdownItems);

        if (dropdownItems.length > index) {
            // Indeksga mos keladigan itemni tanlash
            await dropdownItems[index].click();
        } else {
            console.error(`${dataCyValue} uchun indeksdan tashqarida: ${index}`);
        }
    } catch (error) {
        console.error(`Dropdownni tanlashda xatolik: ${error.message}`);
    }
}

async function selectOption(page, dataCyValue) {
    const element = await page.$(`div[data-cy="${dataCyValue}"]`);
    if (element) {
        await element.click();
    } else {
        throw new Error(`${dataCyValue} element not found`);
    }
}

async function loginOlx(phoneNumber, password, form) {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await page.setViewport({width: 1080, height: 1024});

    // OLX.uz saytiga kirish
    await page.goto('https://www.olx.uz/', {waitUntil: 'networkidle2'});

    await page.click('a[data-cy="myolx-link"]'); // Login tugmasini topib bosish
    await page.waitForSelector('input[name="username"]', {timeout: 10000}); // Telefon raqam kiritish oynasini kutish

    await delay(5000);

    // Telefon raqam va parolni kiritish
    await page.type('input[name="username"]', phoneNumber);
    await page.type('input[name="password"]', password);

    // Login tugmasini bosish
    await page.click('button[type="submit"]');

    // Keyinchalik foydali ma'lumotlarni olish uchun kutish
    await page.waitForNavigation({waitUntil: 'networkidle2', timeout: 30000});

    console.log('Login successful');

    await page.waitForSelector('a[data-cy="post-new-ad-button"]', {timeout: 30000});

    const postNewAdButton = await page.$('a[data-cy="post-new-ad-button"]');
    if (postNewAdButton) {
        await postNewAdButton.click();
    } else {
        throw new Error('Post new ad button not found');
    }

    // E'lon joylash tugmasini bosish

    await page.waitForSelector('textarea[data-cy="posting-title"]', {timeout: 30000});

    let {
        title,
        categoryText,
        imageLinks,
        description,
        price,
        currency,
        purposeDropdownValue,
        isAgreement, // true or false
        personType, // business or private
        area,
        roomsCount,
        totalArea,
        totalLivingAre,
        kitchenArea,
        marketType,
        floor,
        totalFloor,
        houseType,
        layout,
        yearConstruction,
        wc,
        isFurnished,
        ceilingHeight,
        hasApartmentArray,
        hasNearbyArray,
        repairs,
        isCommission,
        automaticNoticePeriod,
        locationText,
        person
    } = form;

    await delay(2000);

    await page.waitForSelector('button[id="select-category-button"]', {timeout: 30000});

    const selectCategoryButton = await page.$('button[id="select-category-button"]');
    if (selectCategoryButton) {
        await selectCategoryButton.click();
    } else {
        throw new Error('Select category button not found');
    }


    await page.waitForSelector('div[data-testid="categories-modal"]', {timeout: 10000});
    await delay(2000);

    await page.click('button[data-categoryid="1"]')

    await delay(2000);
    await page.click('li[data-categoryid="1511"]')
    await delay(2000);
    await page.click('li[data-categoryid="13"]')

    await delay(2000);

    // Title ni kiritish
    const textarea = await page.$('textarea[data-cy="posting-title"]');
    if (textarea) {
        await textarea.type(title)
    }

    // Rasmlar yuklash ishladi
    for (let i = 0; i < imageLinks.length; i++) {
        const imagePath = path.resolve(__dirname, `image${i}.jpg`);
        await downloadImage(imageLinks[i], imagePath);
        const [fileChooser] = await Promise.all([
            page.waitForFileChooser(),
            page.click('input[data-cy="attach-photos-input"]'),
        ]);
        await fileChooser.accept([imagePath]);
    }

    // Izoh yozish
    await page.type('textarea[name="description"]', description)

    await page.waitForSelector('input[data-cy="posting-price"]', {timeout: 5000})
    await page.type('input[data-cy="posting-price"]', price)

    await selectDropdownByIndex(page, 'price-field', currency);

    // Toggle ni boshqarish
    const agreementDiv = await page.$('div[role="radio"]'); // Toggle elementini olish
    const ariaChecked = await page.evaluate(el => el.getAttribute('aria-checked'), agreementDiv);
    if ((isAgreement && ariaChecked === 'false') || (!isAgreement && ariaChecked === 'true')) {
        await agreementDiv.click(); // Toggle holatini o'zgartirish
    }

    // Shaxs turini boshqarish
    if (personType === 'business') {
        await selectOption(page, 'private_business_business');
    } else {
        await selectOption(page, 'private_business_private');
    }

    if (marketType === 'secondary') {
        await selectOption(page, 'parameters.type_of_market_secondary'); // Secondary turini tanlash
    } else {
        await selectOption(page, 'parameters.type_of_market_primary'); // Primary turini tanlash
    }

    // await delay(2000);

    let numberOfRooms = await page.$('input[data-cy="parameters.number_of_rooms"]');
    if (numberOfRooms) {
        await numberOfRooms.type(roomsCount.toString())
    }

    let pageArea = await page.$('input[id="parameters.land_area"]');
    if (pageArea) {
        await pageArea.type(area.toString());
    }

    let pageTotalArea = await page.$('input[data-cy="parameters.total_area"]');
    if (pageTotalArea) {
        await pageTotalArea.type(totalArea.toString());
    }

    let pageTotalLivingArea = await page.$('input[data-cy="parameters.total_living_area"]');
    if (pageTotalLivingArea && totalLivingAre) {
        await pageTotalLivingArea.type(totalLivingAre.toString());
    }

    let pageKitchenArea = await page.$('input[data-cy="parameters.kitchen_area"]');
    if (pageKitchenArea && kitchenArea) {
        await pageKitchenArea.type(kitchenArea.toString());
    }

    let pageFloor = await page.$('input[data-cy="parameters.floor"]');
    if (pageFloor) {
        await pageFloor.type(floor.toString());
    }

    let pageTotalFloor = await page.$('input[data-cy="parameters.total_floors"]');
    if (pageTotalFloor) {
        await pageTotalFloor.type(totalFloor.toString());
    }

    let pageHouseType = await page.$('div[data-cy="parameters.house_type"]')
    if (pageHouseType && houseType) {
        await selectDropdownByIndex(page, 'parameters.house_type', houseType)
    }

    let pageLayout = await page.$('div[data-cy="parameters.layout"]')
    if (pageLayout && layout) {
        await selectDropdownByIndex(page, 'parameters.layout', layout)
    }

    let pageYearConstruction = await page.$('div[data-cy="parameters.year_of_construction_sale"]')
    if (pageYearConstruction && yearConstruction) {
        await selectDropdownByIndex(page, 'parameters.year_of_construction_sale', yearConstruction)
    }

    let pageWc = await page.$('div[data-cy="parameters.wc"]')
    if (pageWc && wc) {
        await selectDropdownByIndex(page, 'parameters.wc', wc)
    }

    await delay(5000);

    if (isFurnished) {
        await selectOption(page, 'parameters.furnished_yes'); // Furnished turini tanlash
    } else {
        await selectOption(page, 'parameters.furnished_no'); // Not furnished turini tanlash
    }

    let pageCeilingHeight = await page.$('input[data-cy="parameters.ceiling_height"]')
    if (ceilingHeight) {
        await pageCeilingHeight.type(ceilingHeight.toString());
    }

    await page.evaluate((hasApartmentArray, hasNearbyArray) => {
        const allCheckboxes = document.querySelectorAll('div[role="checkbox"]');

        const firstArrayEndIndex = 8; // Haqiqiy checkboxlar soniga qarab moslang

        const firstGroupsCheckboxes = Array.from(allCheckboxes).slice(0, firstArrayEndIndex);
        const secondGroupsCheckboxes = Array.from(allCheckboxes).slice(firstArrayEndIndex);

        hasApartmentArray.forEach((index) => {
            if (index < firstGroupsCheckboxes.length) {
                const checkbox = firstGroupsCheckboxes[index];
                if (checkbox.getAttribute('aria-checked') === 'false') {
                    checkbox.click();  // Checkboxni vizual tarzda belgilash uchun click simulyatsiya qilish
                }
            }
        });

        hasNearbyArray.forEach((index) => {
            if (index < secondGroupsCheckboxes.length) {
                const checkbox = secondGroupsCheckboxes[index];
                if (checkbox.getAttribute('aria-checked') === 'false') {
                    checkbox.click();  // Checkboxni vizual tarzda belgilash uchun click simulyatsiya qilish
                }
            }
        });
    }, hasApartmentArray, hasNearbyArray);

    let pageRepairs = await page.$('div[data-cy="parameters.repairs"]')
    if (pageRepairs && repairs) {
        await selectDropdownByIndex(page, 'parameters.repairs', repairs)
    }

    if (isCommission) {
        await selectOption(page, 'parameters.comission_yes'); // Furnished turini tanlash
    } else {
        await selectOption(page, 'parameters.comission_no'); // Not furnished turini tanlash
    }

    // Toggle ni boshqarish
    const automaticNoticeDiv = await page.$('div[role="radio"]'); // Toggle elementini olish
    const automaticNoticeChecked = await page.evaluate(el => el.getAttribute('aria-checked'), automaticNoticeDiv);
    if ((automaticNoticePeriod && automaticNoticeChecked === 'false') || (!automaticNoticePeriod && automaticNoticeChecked === 'true')) {
        await automaticNoticeDiv.click(); // Toggle holatini o'zgartirish
    }

    const locationInput = await page.$('input[data-cy="location-search-input"]');

    const inputValue = await page.evaluate(input => input.value, locationInput);
    if (!inputValue) {
        await locationInput.type(locationText);

        await page.waitForSelector('div[data-cy="location-list"]', {timeout: 30000});

        const firstLocationItem = await page.$('div[data-cy="location-list"] li:first-child');
        if (firstLocationItem) {
            await firstLocationItem.click(); // Birinchi 'li' elementini tanlash
        } else {
            throw new Error('Location list items not found');
        }
    } else {
        console.log('Location input already has a value, skipping typing');
    }

    let pageContactPerson = await page.$('input[data-cy="person"]');
    let pageContactPersonValue = await page.evaluate(input => input.value, pageContactPerson);

    if (pageContactPerson && !pageContactPersonValue) {
        await pageContactPerson.type(person);
    }

    let pageContactPhone = await page.$('input[data-cy="phone"]');
    if (pageContactPhone && phoneNumber) {
        await pageContactPhone.type(phoneNumber);
    }

    await delay(500000)
    await browser.close();
}

// Misol uchun chaqirish
loginOlx('996802208', '1taQanjiqatirgul', {
    title: "Turar joy majmuasi",
    categoryText: "Sotish",
    imageLinks: [
        'https://images.pexels.com/photos/3680219/pexels-photo-3680219.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500',
        'https://images.ctfassets.net/az3stxsro5h5/24L2UM6hV3m4csMvBzkHbj/9d4583541bdb29ae0c6a9ff2b60f1313/After.jpeg?w=2389&h=2986&fl=progressive&q=50&fm=jpg',
        'https://images.unsplash.com/photo-1566275529824-cca6d008f3da?q=80&w=1000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8cGhvdG98ZW58MHx8MHx8fDA%3D'
    ],
    description: "Tavsif berib shuni ma'lum qilish mumkin bu e'lon sizni xech qachon qiziqtirmasin ",
    price: '1000',
    currency: 1,
    purposeDropdownValue: 'Boshqa',
    area: '140',
    personType: 'private',
    isAgreement: true,
    roomsCount: 2,
    totalArea: 130,
    totalLivingAre: 90,
    kitchenArea: 30,
    marketType: 'primary',
    floor: 3,
    totalFloor: 5,
    houseType: 1,
    wc: 0,
    layout: 2,
    yearConstruction: 1,
    isFurnished: true,
    ceilingHeight: 3,
    hasApartmentArray : [0, 2, 4],
    hasNearbyArray: [1, 3, 5],
    isCommission: false,
    repairs: 2,
    automaticNoticePeriod: true,
    locationText: "chilonzor",
    person: 'Azamat'
});
