import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group } from "k6";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function ひとつの販促コードに紐づく商品が１商品
例）商品A（単価100円）3点まで90円
  →　3個購入までは1点90円
    4個からは通常価格100円となる。
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.BUNDLE_MIX}
 * {@link TAGS.LIMIT_ON_NUMBER_OF_POINTS_ACHIEVED}
 * ### テスト観点
 * * 前提：
 * * * ・m_promotion_limited_quantity_discountに販促A～販促Cが設定されている。
 * * * m_promotion_limited_quantity_discountの下記項目に割引条件が設定されている。
 * * * * →　①値引方法区分（coupon_type）→　1:値引指定、2:割引指定、3:売価指定
 * * * * →　②販促値引額（discount_amount）
 * * * * →　③販促割引率（discount_rate）
 * * * * →　④販促価格（unit_price）
 * *     →　⑤値引が発生する数量（点数）
 * * * * 　→　販促値引発生下限点数（discount_lower_limit_item_count）
 * * * * 　→　販促値引発生上限点数（discount_upper_limit_item_count）
 * * * ・販促Aのm_promotion_detail_itemに商品が登録されている。→　販促品（値引額）
 * * * ・販促Bのm_promotion_detail_itemに商品が登録されている。→　販促品（割引率）
 * * * ・販促Cのm_promotion_detail_itemに商品が登録されている。→　販促品（価格）
 * * * ・m_promotion_detail_itemに商品が登録されていない。→　非販促品
 * * * ・m_promotionとm_promotion_gorupにm_promotion_limited_quantity_discountの
 * *     promotion_cdが設定されている。
 * * テスト観点：
 * * * ・販促品（値引額）と2はすべて個数限定割引が適用される。
 * * * ・販促品（価格）は値引が適用される数量のみ個数限定値引が適用される。
 * * * 超過分（販促値引発生上限点数より大きい）は割引されない。
 * * * ・非販促品は個別限定割引は適用されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 販促品（値引額） スキャン | `/sales/cart/barcode` |
 * | 3 | 販促品（値引額）数量変更 | `/sales/cart/changeitemquantity` |
 * | 4 | 販促品（割引率）スキャン | `/sales/cart/barcode` |
 * | - | →販促品（値引額）と2は、値引が適用される数量分スキャンする | - |
 * | 5 | 販促品（割引率）数量変更 | `/sales/cart/changeitemquantity` |
 * | 6 | 販促品（価格）スキャン | `/sales/cart/barcode` |
 * | - | →販促品（価格）は、値引が適用される数量分＋１個スキャンする | - |
 * | 7 | 販促品（価格）数量変更 | `/sales/cart/changeitemquantity` |
 * | 8 | 非販促品スキャン | `/sales/cart/barcode` |
 * | 9 | 小計 | `/sales/subtotal` |
 * | 10 | 支払登録 | `/sales/addpayment` |
 * | 11 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.販促品（値引額）: 4500000002501
 * * 2.販促品（割引率）: 4500000002502
 * * 3.販促品（価格）: 4500000002503
 * * 4.非販促品: 4500000002504
 * * 5.販促値引額: 12501
 * * 6.販促割引率: 12502
 * * 7.販促価格: 12503
 * 
 * ---
 * ### 期待結果
 * * #### 2.`/sales/cart/barcode` 販促品（値引額）
 * * \- カート情報の商品を確認
 * *   販促品（値引額）:
 * * * \+ barcode:  4500000002501
 * * * \+ quantity: 1
 * * * \+ unit_price:  500
 * * * \+ display_unit_price: 500
 * * * \+ rax_rate: 8
 * * * \+ subtotal_discount_apportionment = 100
 * * * \+ total_statement_amount = 400
 * * #### 3.`/sales/cart/changeitemquantity` 販促品（値引額）
 * * \- カート情報の商品を確認
 * *   販促品（値引額）:
 * * * \+ quantity = 2
 * * * \+ subtotal_discount_apportionment = 100
 * * * \+ total_statement_amount = 800
 * * #### 4.`/sales/cart/barcode` 販促品（割引率）
 * * \- カート情報の商品を確認
 * *   販促品（割引率）:
 * * * \+ barcode: 4500000002502
 * * * \+ quantity: 1
 * * * \+ unit_price:  1000
 * * * \+ display_unit_price: 1000
 * * * \+ rax_rate: 8
 * * * \+ quantity 1:
 * * * \+ total_statement_amount = 950
 * * * \+ subtotal_discount_rate = 5
 * * #### 5.`/sales/cart/changeitemquantity` 販促品（割引率）
 * * \- カート情報の商品を確認
 * *   販促品（割引率）:
 * * * \+ quantity = 2
 * * * \+ total_statement_amount =1900
 * * * \+ subtotal_discount_rate = 5
 * * #### 6.`/sales/cart/barcode` 販促品（価格）
 * * \- カート情報の商品を確認
 * *   販促品（価格）:
 * * * \+ barcode: 4500000002503
 * * * \+ quantity: 1
 * * * \+ unit_price:  1500
 * * * \+ display_unit_price: 1500
 * * * \+ rax_rate: 8
 * * * \+ subtotal_discount_apportionment = 1400
 * * * \+ total_statement_amount = 100
 * * #### 7.`/sales/cart/changeitemquantity` 販促品（価格）
 * * \- カート情報の商品を確認
 * *   販促品（価格）:
 * * * \+ quantity = 1
 * * * \+ subtotal_discount_apportionment = 0
 * * * \+ total_statement_amount = 1500
 * * #### 8.`/sales/cart/barcode` 非販促品
 * * \- カート情報の商品を確認
 * *   非販促品:
 * * * \+ barcode: 4500000002504
 * * * \+ quantity: 1
 * * * \+ unit_price:  2000
 * * * \+ display_unit_price: 2000
 * * * \+ rax_rate: 8
 * * * \+ subtotal_discount_apportionment  = 0
 * * * \+ total_statement_amount = 2000
 * * #### 9.`/sales/subtotal`
 * * \- total_balance_amount: 6804 = 800+800*8% +1900+1900*8%+100+100*8%+1500+1500*8%+2000+2000*8%
 * * \- quantity: 7
 * * #### 11.`/sales/end`
 * * \- Confirm Receipt has info:
 * * 販促品（値引額）: 4500000002501
 * * 販促品（割引率）: 4500000002502
 * * 販促品（価格）: 4500000002503
 * * 非販促品: 4500000002504
 */
export function TC_011913001_LimitedQuantityDiscount() {
  group("TC_011913001 ひとつの販促コードに紐づく商品が１商品", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeItemDiscountAmount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（値引額）スキャン"),
      changeQuantityItemDiscountAmount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_QUANTITY, "販促品（値引額）数量変更"),
      barcodeItemDiscountRate: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（割引率）スキャン"),
      changeQuantityItemDiscountRate: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_QUANTITY, "販促品（割引率）数量変更"),
      barcodeItemPrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（価格）スキャン"),
      changeQuantityItemPrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_QUANTITY, "販促品（価格）数量変更"),
      barcodeNonPromo: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "非販促品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const updatedQuantity = 2; // Test data
    const itemDiscountAmount = 100 // Specified in master with promotion, discount direct
    const itemDiscountRate = 5 // Specified in master with promotion, discount rate
    const itemUnitPriceFixed = 100 // Specified in master with promotion, fixed price
    const itemDiscountPrice = 500; // Specified in master
    const itemDiscountTaxRate = 8; // Specified in master
    const itemDiscountRatePrice = 1000; // Specified in master
    const itemDiscountRateTaxRate = 8; // Specified in master
    const itemPrice = 1500; // Specified in master
    const itemPriceTaxRate = 8; // Specified in master
    const itemNonPromoPrice = 2000; // Specified in master
    const itemNonPromoTaxRate = 8; // Specified in master

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.販促品（値引額） スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeItemDiscountAmount, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.ITEM_DISCOUNT_AMOUNT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（値引額）",
        expected: {
          barcode: PROD.ITEM_DISCOUNT_AMOUNT,
          quantity: 1,
          unitPrice: itemDiscountPrice,
          displayUnitPrice: itemDiscountPrice,
          taxRate: itemDiscountTaxRate,
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            quantity: res.result?.cartinfo?.items?.[0]?.quantity,
            unitPrice: res.result?.cartinfo?.items?.[0]?.unit_price,
            displayUnitPrice: res.result?.cartinfo?.items?.[0]?.display_unit_price,
            taxRate: res.result?.cartinfo?.items?.[0]?.tax_rate,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）discount when quantity 1",
        expected: (res) => {
          const price = res.result?.cartinfo?.items?.[0]?.display_unit_price;
          return {
            subtotalDiscountApportionment: itemDiscountAmount,
            totalStatementAmount: price - itemDiscountAmount,
          };
        },
        actual: (res) => {
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[0]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[0]?.total_statement_amount,
          };
        },
      }),
    ]);

    // 3.販促品（値引額）数量変更 /sales/cart/changeitemquantity
    const itemDiscountAmountQuantity = TestHelper.salesCartChangeItemQuantity(step.changeQuantityItemDiscountAmount, {
      cartNo,
      statementNo: 0,
      updatedQuantity,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify quantity 販促品（値引額）",
        expected: updatedQuantity,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.quantity,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）discount when quantity 2",
        expected: (res) => {
          const price = res.result?.cartinfo?.items?.[0]?.display_unit_price;
          return {
            subtotalDiscountApportionment: itemDiscountAmount,
            totalStatementAmount: (price - itemDiscountAmount) * updatedQuantity,
          };
        },
        actual: (res) => {
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[0]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[0]?.total_statement_amount,
          };
        },
      }),
    ]).result?.cartinfo?.items?.[0]?.quantity;

    // 4.販促品（割引率）スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeItemDiscountRate, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.ITEM_DISCOUNT_RATE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 商販促品（割引率）",
        expected: {
          barcode: PROD.ITEM_DISCOUNT_RATE,
          quantity: 1,
          unitPrice: itemDiscountRatePrice,
          displayUnitPrice: itemDiscountRatePrice,
          taxRate: itemDiscountRateTaxRate,
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[1]?.barcode,
            quantity: res.result?.cartinfo?.items?.[1]?.quantity,
            unitPrice: res.result?.cartinfo?.items?.[1]?.unit_price,
            displayUnitPrice: res.result?.cartinfo?.items?.[1]?.display_unit_price,
            taxRate: res.result?.cartinfo?.items?.[1]?.tax_rate,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）discount when quantity 1",
        expected: (res) => {
          const price = res.result?.cartinfo?.items?.[1]?.display_unit_price;
          const subtotalDiscountApportionment = price * itemDiscountRate / 100;
          return price - subtotalDiscountApportionment;
        },
        actual: (res) => res.result?.cartinfo?.items?.[1]?.total_statement_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify discount rate",
        expected: itemDiscountRate,
        actual: (res) => res.result?.cartinfo?.subtotal_discounts?.[1]?.subtotal_discount_rate,
      }),
    ]);

    // 5.販促品（割引率）数量変更 /sales/cart/changeitemquantity
    const itemDiscountRateQuantity = TestHelper.salesCartChangeItemQuantity(step.changeQuantityItemDiscountRate, {
      cartNo,
      statementNo: 1,
      updatedQuantity,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify quantity 販促品（割引率）",
        expected: updatedQuantity,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.quantity,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 商販促品（割引率）discount when quantity 2",
        expected: (res) => {
          const price = res.result?.cartinfo?.items?.[1]?.display_unit_price;
          const subtotalDiscountApportionment = price * itemDiscountRate / 100;
          return (price - subtotalDiscountApportionment) * updatedQuantity;
        },
        actual: (res) => res.result?.cartinfo?.items?.[1]?.total_statement_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify discount rate",
        expected: itemDiscountRate,
        actual: (res) => res.result?.cartinfo?.subtotal_discounts?.[1]?.subtotal_discount_rate,
      }),
    ]).result?.cartinfo?.items?.[1]?.quantity;

    //6.販促品（価格）スキャン /sales/cart/barcode
    const itemPriceQuantity = TestHelper.salesCartBarcode(step.barcodeItemPrice, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.ITEM_PRICE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（価格）",
        expected: {
          barcode: PROD.ITEM_PRICE,
          quantity: 1,
          unitPrice: itemPrice,
          displayUnitPrice: itemPrice,
          taxRate: itemPriceTaxRate,
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[2]?.barcode,
            quantity: res.result?.cartinfo?.items?.[2]?.quantity,
            unitPrice: res.result?.cartinfo?.items?.[2]?.unit_price,
            displayUnitPrice: res.result?.cartinfo?.items?.[2]?.display_unit_price,
            taxRate: res.result?.cartinfo?.items?.[2]?.tax_rate,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）discount when quantity 1",
        expected: (res) => {
          const price = res.result?.cartinfo?.items?.[2]?.display_unit_price;
          return {
            subtotalDiscountApportionment: price - itemUnitPriceFixed,
            totalStatementAmount: itemUnitPriceFixed,
          };
        },
        actual: (res) => {
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[2]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[2]?.total_statement_amount,
          };
        },
      }),
    ]).result?.cartinfo?.items?.[2]?.quantity;

    // 7.販促品（価格）数量変更 /sales/cart/changeitemquantity
    const itemPriceNoDiscountQuantity = TestHelper.salesCartChangeItemQuantity(step.changeQuantityItemPrice, {
      cartNo,
      statementNo: 2,
      updatedQuantity,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify quantity 販促品（価格）no discount",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.items?.[3]?.quantity,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）no discount",
        expected: (res) => {
          const price = res.result?.cartinfo?.items?.[3]?.display_unit_price;
          return {
            subtotalDiscountApportionment: 0, // no discount
            totalStatementAmount: price, // no discount
          };
        },
        actual: (res) => {
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[3]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[3]?.total_statement_amount,
          };
        },
      }),
    ]).result?.cartinfo?.items?.[3]?.quantity;

    // 8.非販促品スキャン /sales/cart/barcode
    const itemNonPromoQuantity = TestHelper.salesCartBarcode(step.barcodeNonPromo, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NON_PROMO,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 非販促品",
        expected: {
          barcode: PROD.NON_PROMO,
          quantity: 1,
          unitPrice: itemNonPromoPrice,
          displayUnitPrice: itemNonPromoPrice,
          taxRate: itemNonPromoTaxRate,
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[4]?.barcode,
            quantity: res.result?.cartinfo?.items?.[4]?.quantity,
            unitPrice: res.result?.cartinfo?.items?.[4]?.unit_price,
            displayUnitPrice: res.result?.cartinfo?.items?.[4]?.display_unit_price,
            taxRate: res.result?.cartinfo?.items?.[4]?.tax_rate,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 非販促品 discount when quantity 1",
        expected: (res) => {
          const price = res.result?.cartinfo?.items?.[4]?.display_unit_price;
          return {
            subtotalDiscountApportionment: 0, // no discount
            totalStatementAmount: price, // no discount
          };
        },
        actual: (res) => {
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[4]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[4]?.total_statement_amount,
          };
        },
      }),
    ]).result?.cartinfo?.items?.[4]?.quantity;;

    // 9.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total quantity",
        expected: [
          itemDiscountAmountQuantity,
          itemDiscountRateQuantity,
          itemPriceQuantity,
          itemPriceNoDiscountQuantity,
          itemNonPromoQuantity,
        ].reduce((total, qty) => total + (qty ?? 0), 0),
        actual: (res) => res.result?.cartinfo?.total_quantity,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 10.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 11.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain 4 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.ITEM_DISCOUNT_AMOUNT,
          PROD.ITEM_DISCOUNT_RATE,
          PROD.ITEM_PRICE,
          PROD.NON_PROMO,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function ひとつの販促コードに紐づく商品が複数商品
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.BUNDLE_MIX}
 * {@link TAGS.UNLIMITED_NUMBER_OF_POINTS}
 * ### テスト観点
 * * 前提：
 * * * ・m_promotion_limited_quantity_discountに販促A～販促Cが設定されている。
 * * * m_promotion_limited_quantity_discountの下記項目に割引条件が設定されている。
 * * * * →　①値引方法区分（coupon_type）→　1:値引指定、2:割引指定、3:売価指定
 * * * * →　②販促値引額（discount_amount）
 * * * * →　③販促割引率（discount_rate）
 * * * * →　④販促価格（unit_price）
 * *     →　⑤値引が発生する数量（点数）
 * * * * 　→　販促値引発生下限点数（discount_lower_limit_item_count）
 * * * * 　→　販促値引発生上限点数（discount_upper_limit_item_count）
 * * * ・販促Aのm_promotion_detail_itemに商品が登録されている。
 * * * → 商品A､B､C
 * * 販促品（値引額）1、販促品（値引額）2 、販促品（値引額）3 
 * * * ・販促Bのm_promotion_detail_itemに商品が登録されている。
 * * * → 商品D､E､F
 * * 販促品（割引率）1、販促品（割引率）2 、販促品（割引率）3 
 * * * ・販促Cのm_promotion_detail_itemに商品が登録されている。
 * * * → 商品G､H､J
 * * 販促品（価格）1、販促品（価格）2 、 販促品（価格）3
 * * * ・m_promotion_detail_itemに商品が登録されていない。
 * * 商品K
 * * 非販促品
 * * * ・m_promotionとm_promotion_gorupにm_promotion_limited_quantity_discountの
 * *     promotion_cdが設定されている。
 * * テスト観点：
 * * * ・商品A～Jはすべて個数限定割引が適用される。
 * * * ・販促品（値引額）1～ 販促品（価格）3はすべて個数限定割引が適用される。
 * * * ・商品Kは個別限定割引は適用されない。
 * * * ・非販促品は個別限定割引は適用されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 販促品（値引額）1スキャン (販促値引) | `/sales/cart/barcode` |
 * | 3 | 販促品（値引額）2スキャン(販促値引) | `/sales/cart/barcode` |
 * | 4 | 販促品（値引額）3スキャン(販促値引) | `/sales/cart/barcode` |
 * | 5 | 販促品（値引額）1スキャン (販促値引) | `/sales/cart/barcode` |
 * | 6 | 販促品（割引率）1スキャン (販促割引) | `/sales/cart/barcode` |
 * | 7 | 販促品（割引率）2スキャン (販促割引) | `/sales/cart/barcode` |
 * | 8 | 販促品（割引率）3スキャン (販促割引) | `/sales/cart/barcode` |
 * | 9 | 販促品（割引率）1スキャン (販促割引) | `/sales/cart/barcode` |
 * | 10 | 販促品（価格）1スキャン (販促価格) | `/sales/cart/barcode` |
 * | 11 | 販促品（価格）2スキャン (販促価格) | `/sales/cart/barcode` |
 * | 12 | 販促品（価格）3スキャン (販促価格) | `/sales/cart/barcode` |
 * | 13 | 販促品（価格）1スキャン (販促価格) | `/sales/cart/barcode` |
 * | 14 | 非販促品スキャン (非販促) | `/sales/cart/barcode` |
 * | 15 | 小計 | `/sales/subtotal` |
 * | 16 | 支払登録 | `/sales/addpayment` |
 * | 17 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * *  1. 販促品（値引額）1        : 4500000002505
 * *  2. 販促品（値引額）2        : 4500000002506
 * *  3. 販促品（値引額）3        : 4500000002507
 * *  4. 販促品（割引率）1        : 4500000002508
 * *  5. 販促品（割引率）2        : 4500000002509
 * *  6. 販促品（割引率）3        : 4500000002510
 * *  7. 販促品（価格）1          : 4500000002511
 * *  8. 販促品（価格）2          : 4500000002512
 * *  9. 販促品（価格）3          : 4500000002513
 * * 10. 非販促品                 : 4500000002504
 * * 11. 値引額                   : 100
 * * 12. 割引率                   : 5
 * * 13. 価格                     : 100
 * * 14. 販促値引発生下限点数     : 2
 * * 15. 販促値引発生上限点数     : 3
 * 
 * ---
 * ### 期待結果
 * * #### 2.販促品（値引額）1スキャン (販促値引) `/sales/cart/barcode`
 * * \- Cart Info に 販促品（値引額）1 があるか確認
 * * * \+ バーコード: 4500000002505
 * * \- 販促品（値引額）1 は 販促値引に適用されいないか確認 （discount_lower_limit_item_count=2であるため）
 * * * \+ display_unit_price : 500
 * * * \+ subtotal_discount_apportionment: 0
 * * * \+ total_statement_amount = display_unit_price - subtotal_discount_apportionment = 500
 * * #### 3.販促品（値引額）2スキャン (販促値引) `/sales/cart/barcode`
 * * \- Cart Info に 販促品（値引額）2 があるか確認
 * * * \+ バーコード: 4500000002506
 * * * \+ display_unit_price: 1000
 * * \- 販促品（値引額）1 と 販促品（値引額）2 は 販促値引に属するか確認
 * * * \+ subtotal_discount_amount = 値引額 x 商品数量 = 100x2 = 200
 * * * \+ subtotal_discounts.target_items に 0 がある
 * * * \+ subtotal_discounts.target_items に 1 がある
 * * \- 促品（値引額）1 は販促値引に適用されるか確認
 * * * \+ total_statement_amount < display_unit_price
 * * * \+ subtotal_discount_apportionment = 値引額 = 100
 * * * \+ total_statement_amount = (display_unit_price- subtotal_discount_apportionment) x 数量 = (500-100)x1 = 400
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 400 x 8 / 100 = 32
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 400 + 32 = 432
 * * \- 販促品（値引額）2 は販促値引に適用されるか確認
 * * * \+ subtotal_discount_apportionment = 値引額  = 100
 * * * \+ total_statement_amount = (display_unit_price- subtotal_discount_apportionment) x 数量 = (1000-100) x 1 = 900
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 900 x 8 / 100 = 72
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 900 + 72 = 972
 * * #### 4.販促品（値引額）3スキャン (販促値引)`/sales/cart/barcode`
 * * \- Cart Info に 販促品（値引額）3 があるか確認
 * * * \+ バーコード: 4500000002507
 * * * \+ display_unit_price: 1500
 * * \- 販促品（値引額）3 は販促値引に属するか確認
 * * * \+ subtotal_discount_amount = 値引額 x 商品数量 = 100x3 = 300
 * * * \+ subtotal_discounts.target_items に 2 がある
 * * \- 販促品（値引額）3 は販促値引に適用されるか確認
 * * * \+ subtotal_discount_apportionment = 値引額  = 100
 * * * \+ total_statement_amount = (display_unit_price - subtotal_discount_apportionment ) x 数量 = (1500-100) x 1 = 1400
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 1400 x 8 / 100 = 112
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 1400 + 112 = 1512
 * * #### 5.販促品（値引額）1スキャン (販促値引)`/sales/cart/barcode`
 * * \- 販促品（値引額）1 販促値引に適用されいないか確認 （discount_upper_limit_item_count=3であるため）
 * * * \+ display_unit_price : 500
 * * * \+ subtotal_discount_apportionment: 0
 * * * \+ total_statement_amount = display_unit_price - subtotal_discount_apportionment = 500
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 500 x 8 / 100 = 40
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 500 + 40 = 540
 * * #### 6.販促品（割引率）1スキャン (販促割引) `/sales/cart/barcode`
 * * \- Cart Info にて 販促品（割引率）1があるか確認
 * * * \+ バーコード: 4500000002508
 * * \- 販促品（割引率）1 は販促割引に適用されないか確認 （discount_lower_limit_item_count=2であるため）
 * * * \+ display_unit_price : 500
 * * * \+ subtotal_discount_apportionment: 0
 * * * \+ total_statement_amount = display_unit_price - subtotal_discount_apportionment = 500
 * * #### 7.販促品（割引率）2スキャン (販促割引) `/sales/cart/barcode`
 * * \-Cart Info にて 販促品（割引率）2があるか確認
 * * * \+ バーコード: 4500000002509
 * * * \+ display_unit_price: 1000
 * * \- 販促品（割引率）1 と 販促品（割引率）2 は 販促割引に属するか確認
 * * * \+ subtotal_discount_rate = 5
 * * * \+ subtotal_discount_amount = subtotal_discount_amount (販促品（割引率）1 ) + subtotal_discount_amount (販促品（割引率）2) = 25+50 = 75
 * * * * \. subtotal_discount_amount (販促品（割引率）1 )= display_unit_price x subtotal_discount_rate:100 = 500x5:100 = 25
 * * * * \. subtotal_discount_amount (販促品（割引率）2) = (display_unit_price x subtotal_discount_rate:100) x 数量 + discount amount before = (1000x5:100)x1 = 50
 * * * \+ subtotal_discounts.target_items に 4がある
 * * * \+ subtotal_discounts.target_items に 5がある
 * * \- 販促品（割引率）1 は販促割引に適用されたか確認
 * * * \+ total_statement_amount < display_unit_price
 * * * \+ subtotal_discount_apportionment = display_unit_price x subtotal_discount_rate:100 = 500x5:100 = 25
 * * * \+ total_statement_amount = (display_unit_price- subtotal_discount_apportionment ) x quantity =  (500-25)x1 = 475
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 475 x 8 / 100 = 38
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 475 + 38 = 513
 * * \-  販促品（割引率）2 は販促割引に適用されたか確認
 * * * \+ subtotal_discount_apportionment = display_unit_price x subtotal_discount_rate:100 = 1000x5:100 = 50
 * * * \+ total_statement_amount = (display_unit_price - subtotal_discount_apportionment)x quantity = (1000-50)x1 = 950
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 950 x  8 / 100 = 76
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 950 + 76 = 1026
 * * #### 8.販促品（割引率）3スキャン (販促割引) `/sales/cart/barcode`
 * * \- Cart Info に 販促品（割引率）3があるか確認
 * * * \+ バーコード: 4500000002510
 * * * \+ display_unit_price: 1500
 * * \- 販促品（割引率）3 は販促割引に属するか確認
 * * * \+ subtotal_discount_rate = 5
 * * * \+ subtotal_discount_amount = subtotal_discount_amount
 * * * \+ subtotal_discount_amount = (display_unit_price x subtotal_discount_rate:100) x 数量 + discount amount before = (1500x5:100)x1+75 = 150
 * * * \+ subtotal_discounts.target_items に 6 がある
 * * \- 販促品（割引率）3 は販促割引に適用されるか確認
 * * * \+ subtotal_discount_apportionment = display_unit_price x subtotal_discount_rate:100 = 1500x5:100 = 75
 * * * \+ total_statement_amount = (display_unit_price - subtotal_discount_apportionment) x 数量 = (1500-75)x1 = 1425
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 1425 x 8 / 100 = 114
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 1425 + 114 = 1539
 * * #### 9.販促品（割引率）1スキャン (販促割引) `/sales/cart/barcode`
 * * \- 販促品（値引額）1 は販促値引に適用されない（discount_upper_limit_item_count=3であるため）
 * * * \+ display_unit_price : 500
 * * * \+ subtotal_discount_apportionment: 0
 * * * \+ total_statement_amount = display_unit_price - subtotal_discount_apportionment = 500
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 500 x 8 / 100 = 40
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 500 + tax = 540
 * * #### 10.販促品（価格）1スキャン (販促価格) `/sales/cart/barcode`
 * * \- Cart Info に 販促品（価格）1 があるか確認
 * * * \+ バーコード: 4500000002511
 * * \- 販促品（価格）1 は販促価格に適用されない（discount_lower_limit_item_count=2であるため）
 * * * \+ display_unit_price : 1100
 * * * \+ subtotal_discount_apportionment: 0
 * * * \+ total_statement_amount = display_unit_price - subtotal_discount_apportionment = 1100
 * * #### 11.販促品（価格）2スキャン (販促価格) `/sales/cart/barcode`
 * * \-  Cart Info に 販促品（価格）2があるか確認
 * * * \+ バーコード: 4500000002512
 * * * \+ display_unit_price: 1150
 * * \-  販促品（価格）1 , 販促品（価格）2 は販促価格に属するか確認
 * * * \+ subtotal_discount_amount = subtotal_discount_amount (販促品（価格）1 ) + subtotal_discount_amount (販促品（価格）2) = 100 +150 = 250
 * * * * \. subtotal_discount_amount (販促品（価格）1) = (display_unit_price - 価格) x 数量 + discount amount before = (1100-1000)x1+0 = 100
 * * * * \. subtotal_discount_amount ((販促品（価格）2))= (display_unit_price - 価格) x 数量 = (1150-1000)x1 = 150
 * * * \+ subtotal_discounts.target_items に 8がある
 * * * \+ subtotal_discounts.target_items に 9がある
 * * \-販促品（価格）1 は販促価格に適用されるか確認
 * * * \+ total_statement_amount < display_unit_price
 * * * \+ subtotal_discount_apportionment = display_unit_price - 価格 = 1100-1000 = 100
 * * * \+ total_statement_amount = 価格 x 数量 = 1000x1 = 1000
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 1000 x  8 / 100 = 80
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 1000 + 80 = 1080
 * * \- 販促品（価格）2 は販促価格に適用されるか確認
 * * * \+ subtotal_discount_apportionment = display_unit_price - 価格 = 1150-1000 = 150
 * * * \+ total_statement_amount = 価格 x 数量 = 1000x1 = 1000
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 1000 x  8 / 100 = 80
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 1000 + 80 = 1080
 * * #### 12.販促品（価格）3スキャン (販促価格) `/sales/cart/barcode`
 * * \- Cart Info に販促品（価格）3があるか確認
 * * * \+ バーコード: 4500000002513
 * * * \+ display_unit_price: 1200
 * * \- 販促品（価格）3 に販促価格に適用されるか確認
 * * * \+ subtotal_discount_amount = display_unit_price - 価格) x 数量 + discount amount before = (1200-1000)x1+250 = 450
 * * * \+ subtotal_discounts.target_items に 10があるか確認
 * * \- 販促品（価格）3 は販促価格に適用されるか確認
 * * * \+ subtotal_discount_apportionment = display_unit_price - 価格 = 1200-1000 = 200
 * * * \+ total_statement_amount  = 価格 x 数量 = 1000x1 = 1000x1
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 1000 x  8 / 100 = 80
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 1000 + 80 = 1080
 * * #### 13.販促品（価格）1スキャン (販促価格) `/sales/cart/barcode`
 * * \-  販促品（価格）1は販促価格に適用されないか確認（discount_upper_limit_item_count=3であるため）
 * * * \+ display_unit_price : 1100
 * * * \+ subtotal_discount_apportionment: 0
 * * * \+ total_statement_amount = display_unit_price - subtotal_discount_apportionment = 1100
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 1100 x  8 / 100 = 88
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 1100 + 88 = 1188
 * * #### 14.非販促品スキャン (非販促商品) `/sales/cart/barcode`
 * * \- 非販促品 は販促に適用されないか確認
 * * * \+ display_unit_price : 2000
 * * * \+ subtotal_discount_apportionment: 0
 * * * \+ total_statement_amount = display_unit_price - subtotal_discount_apportionment = 2000
 * * * \+ tax = total_statement_amount x tax_rate / 100 = 2000 x  8 / 100 = 160
 * * * \+ totalAmountWithTax = total_statement_amount + tax = 2000 + 160 = 2160
 * * #### 15.小計 `/sales/subtotal`
 * * 以下が正しいか確認
 * * \- total_balance_amount = 全て商品の小計（税込）= 432+972+1512+540+513+1026+1539+540+1080+1080+1080+1188+2160 = 13662"
 */
export function TC_011913002_LimitedQuantityDiscount() {
  group("TC_011913002 ひとつの販促コードに紐づく商品が複数商品", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDiscountAmount1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（値引額）1スキャン (販促値引)"),
      barcodeDiscountAmount2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（値引額）2スキャン (販促値引)"),
      barcodeDiscountAmount3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（値引額）3スキャン (販促値引)"),
      barcodeDiscountAmount1Rescan: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（値引額）1スキャン (販促値引) (2nd)"),
      barcodeDiscountRate1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（割引率）1スキャン (販促割引)"),
      barcodeDiscountRate2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（割引率）2スキャン (販促割引)"),
      barcodeDiscountRate3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（割引率）3スキャン (販促割引)"),
      barcodeDiscountRate1Rescan: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（割引率）1スキャン (販促割引) (2nd)"),
      barcodeDiscountPrice1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（価格）1スキャン (販促価格)"),
      barcodeDiscountPrice2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（価格）2スキャン (販促価格)"),
      barcodeDiscountPrice3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（価格）3スキャン (販促価格)"),
      barcodeDiscountPrice1Rescan: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（価格）1スキャン (販促価格) (2nd)"),
      barcodeNonPromo: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "非販促品スキャン (非販促)"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const discountAmount = 100; // Test data
    const discountRate = 5; // Test data
    const discountPrice = 1000; // Test data
    const promoDiscountMinimum = 2; // Test data
    const promoDiscountMaximum = 3; // Test data
    const subtotalDiscountApportionmentNotApply = 0; // Test data, amount not apply discount
    const discountAmount1Price = 500; // Specified in master
    const discountAmount2Price = 1000; // Specified in master
    const discountAmount3Price = 1500; // Specified in master
    const discountRate1Price = 500; // Specified in master
    const discountRate2Price = 1000; // Specified in master
    const discountRate3Price = 1500; // Specified in master
    const discountPrice1Price = 1100; // Specified in master
    const discountPrice2Price = 1150; // Specified in master
    const discountPrice3Price = 1200; // Specified in master
    const discountNonPromoPrice = 2000; // Specified in master
    let discountAmountRateBefore = 0;
    let discountAmountPriceBefore = 0;

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountAmount1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_AMOUNT_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（値引額）1",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.DISCOUNT_AMOUNT_1,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）1 not discounted yet",
        expected: (res) => {
          const discountAmount1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_1);
          return {
            displayUnitPrice: discountAmount1Price,
            subtotalDiscountApportionment: subtotalDiscountApportionmentNotApply,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountAmount1Idx]),
          };
        },
        actual: (res) => {
          const discountAmount1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_1);
          return {
            displayUnitPrice: res.result?.cartinfo?.items?.[discountAmount1Idx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountAmount1Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountAmount1Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountAmount2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_AMOUNT_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（値引額）2",
        expected: {
          barcode: PROD.DISCOUNT_AMOUNT_2,
          displayUnitPrice: discountAmount2Price,
        },
        actual: (res) => {
          const discountAmount2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_2);
          return {
            barcode: res.result?.cartinfo?.items?.[discountAmount2Idx]?.barcode,
            displayUnitPrice: res.result?.cartinfo?.items?.[discountAmount2Idx]?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount amount of 値引額 discount group",
        expected: discountAmount * promoDiscountMinimum,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          return subtotalDiscount?.subtotal_discount_amount;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）1 belong to the 値引額 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          const discountAmount1Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_1);
          return subtotalDiscount?.target_items?.includes(discountAmount1Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）2 belong to the 値引額 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          const discountAmount2Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_2);
          return subtotalDiscount?.target_items?.includes(discountAmount2Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）1 get discount",
        expected: (res) => {
          const discountAmount1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_1);
          return {
            isDiscount: true,
            subtotalDiscountApportionment: discountAmount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountAmount1Idx]),
          };
        },
        actual: (res) => {
          const discountAmount1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_1);
          return {
            isDiscount: res.result?.cartinfo?.items?.[discountAmount1Idx]?.total_statement_amount < res.result?.cartinfo?.items?.[discountAmount1Idx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountAmount1Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountAmount1Idx]?.total_statement_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）2 get discount",
        expected: (res) => {
          const discountAmount2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_2);
          return {
            subtotalDiscountApportionment: discountAmount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountAmount2Idx]),
          };
        },
        actual: (res) => {
          const discountAmount2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_2);
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountAmount2Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountAmount2Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountAmount3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_AMOUNT_3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（値引額）3",
        expected: {
          barcode: PROD.DISCOUNT_AMOUNT_3,
          displayUnitPrice: discountAmount3Price,
        },
        actual: (res) => {
          const discountAmount3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_3);
          return {
            barcode: res.result?.cartinfo?.items?.[discountAmount3Idx]?.barcode,
            displayUnitPrice: res.result?.cartinfo?.items?.[discountAmount3Idx]?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount amount of 値引額 discount group",
        expected: discountAmount * promoDiscountMaximum,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          return subtotalDiscount?.subtotal_discount_amount;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）3 belong to the 値引額 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          const discountAmount3Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_3);
          return subtotalDiscount?.target_items?.includes(discountAmount3Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）3 get discount",
        expected: (res) => {
          const discountAmount3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_3);
          return {
            subtotalDiscountApportionment: discountAmount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountAmount3Idx]),
          };
        },
        actual: (res) => {
          const discountAmount3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_3);
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountAmount3Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountAmount3Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountAmount1Rescan, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_AMOUNT_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（値引額）1 (2nd) not discounted",
        expected: (res) => {
          const discountAmount3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_3);
          const discountAmount1SecondIdx = discountAmount3Idx + 1;
          return {
            displayUnitPrice: discountAmount1Price,
            subtotalDiscountApportionment: subtotalDiscountApportionmentNotApply,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountAmount1SecondIdx]),
          };
        },
        actual: (res) => {
          const discountAmount3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_AMOUNT_3);
          const discountAmount1SecondIdx = discountAmount3Idx + 1;
          return {
            displayUnitPrice: res.result?.cartinfo?.items?.[discountAmount1SecondIdx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountAmount1SecondIdx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountAmount1SecondIdx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountRate1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_RATE_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（割引率）1",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.DISCOUNT_RATE_1,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）1 not discounted yet",
        expected: (res) => {
          const discountRate1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_1);
          return {
            displayUnitPrice: discountRate1Price,
            subtotalDiscountApportionment: subtotalDiscountApportionmentNotApply,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountRate1Idx]),
          };
        },
        actual: (res) => {
          const discountRate1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_1);
          return {
            displayUnitPrice: res.result?.cartinfo?.items?.[discountRate1Idx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountRate1Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountRate1Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountRate2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_RATE_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（割引率）2",
        expected: {
          barcode: PROD.DISCOUNT_RATE_2,
          displayUnitPrice: discountRate2Price,
        },
        actual: (res) => {
          const discountRate2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_2);
          return {
            barcode: res.result?.cartinfo?.items?.[discountRate2Idx]?.barcode,
            displayUnitPrice: res.result?.cartinfo?.items?.[discountRate2Idx]?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount amount of 割引率 discount group",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const discountRate1Idx = items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_1);
          const discountRate2Idx = items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_2);
          const subtotalDiscountRate1 = (discountRate1Price * discountRate / 100) * items?.[discountRate1Idx]?.quantity;
          const subtotalDiscountRate2 = (discountRate2Price * discountRate / 100) * items?.[discountRate2Idx]?.quantity;
          discountAmountRateBefore = subtotalDiscountRate1 + subtotalDiscountRate2;
          return discountAmountRateBefore;
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          return subtotalDiscount?.subtotal_discount_amount;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）1 belong to the 割引率 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          const discountRate1Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_1);
          return subtotalDiscount?.target_items?.includes(discountRate1Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）2 belong to the 割引率 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          const discountRate2Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_2);
          return subtotalDiscount?.target_items?.includes(discountRate2Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）1 get discount",
        expected: (res) => {
          const discount = discountRate1Price * discountRate / 100;
          const discountRate1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_1);
          return {
            isDiscount: true,
            subtotalDiscountApportionment: discount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountRate1Idx]),
          };
        },
        actual: (res) => {
          const discountRate1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_1);
          return {
            isDiscount: res.result?.cartinfo?.items?.[discountRate1Idx]?.total_statement_amount < res.result?.cartinfo?.items?.[discountRate1Idx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountRate1Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountRate1Idx]?.total_statement_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）2 get discount",
        expected: (res) => {
          const discount = discountRate2Price * discountRate / 100;
          const discountRate2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_2);
          return {
            subtotalDiscountApportionment: discount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountRate2Idx]),
          };
        },
        actual: (res) => {
          const discountRate2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_2);
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountRate2Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountRate2Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountRate3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_RATE_3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（割引率）3",
        expected: {
          barcode: PROD.DISCOUNT_RATE_3,
          displayUnitPrice: discountRate3Price,
        },
        actual: (res) => {
          const discountRate3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_3);
          return {
            barcode: res.result?.cartinfo?.items?.[discountRate3Idx]?.barcode,
            displayUnitPrice: res.result?.cartinfo?.items?.[discountRate3Idx]?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount rate and subtotal discount amount of 割引率 discount group",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const discountRate3Idx = items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_3);
          const discount = (discountRate3Price * discountRate / 100) * items?.[discountRate3Idx]?.quantity + discountAmountRateBefore;
          return {
            subtotalDiscountRate: discountRate,
            subtotalDiscountAmount: discount,
          };
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          return {
            subtotalDiscountRate: subtotalDiscount?.subtotal_discount_rate,
            subtotalDiscountAmount: subtotalDiscount?.subtotal_discount_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）3 belong to the 割引率 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          const discountRate3Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_3);
          return subtotalDiscount?.target_items?.includes(discountRate3Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）3 get discount",
        expected: (res) => {
          const discount = discountRate3Price * discountRate / 100;
          const discountRate3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_3);
          return {
            subtotalDiscountApportionment: discount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountRate3Idx]),
          };
        },
        actual: (res) => {
          const discountRate3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_3);
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountRate3Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountRate3Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountRate1Rescan, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_AMOUNT_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（割引率）1 (2nd) not discounted",
        expected: (res) => {
          const discountRate3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_3);
          const discountRate1SecondIdx = discountRate3Idx + 1;
          return {
            displayUnitPrice: discountAmount1Price,
            subtotalDiscountApportionment: subtotalDiscountApportionmentNotApply,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountRate1SecondIdx]),
          };
        },
        actual: (res) => {
          const discountRate3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_RATE_3);
          const discountRate1SecondIdx = discountRate3Idx + 1;
          return {
            displayUnitPrice: res.result?.cartinfo?.items?.[discountRate1SecondIdx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountRate1SecondIdx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountRate1SecondIdx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountPrice1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_PRICE_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（価格）1",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.DISCOUNT_PRICE_1,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）1 not discounted yet",
        expected: (res) => {
          const discountPrice1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_1);
          return {
            displayUnitPrice: discountPrice1Price,
            subtotalDiscountApportionment: subtotalDiscountApportionmentNotApply,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountPrice1Idx]),
          };
        },
        actual: (res) => {
          const discountPrice1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_1);
          return {
            displayUnitPrice: res.result?.cartinfo?.items?.[discountPrice1Idx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountPrice1Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountPrice1Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountPrice2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_PRICE_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（価格）2",
        expected: {
          barcode: PROD.DISCOUNT_PRICE_2,
          displayUnitPrice: discountPrice2Price,
        },
        actual: (res) => {
          const discountPrice2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_2);
          return {
            barcode: res.result?.cartinfo?.items?.[discountPrice2Idx]?.barcode,
            displayUnitPrice: res.result?.cartinfo?.items?.[discountPrice2Idx]?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount amount of 価格 discount group",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const discountPrice1Idx = items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_1);
          const discountPrice2Idx = items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_2);
          const subtotalDiscountRate1 = (discountPrice1Price - discountPrice) * items?.[discountPrice1Idx]?.quantity;
          const subtotalDiscountRate2 = (discountPrice2Price - discountPrice) * items?.[discountPrice2Idx]?.quantity;
          discountAmountPriceBefore = subtotalDiscountRate1 + subtotalDiscountRate2;
          return discountAmountPriceBefore;
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          return subtotalDiscount?.subtotal_discount_amount;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）1 belong to the 価格 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          const discountPrice1Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_1);
          return subtotalDiscount?.target_items?.includes(discountPrice1Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）1 belong to the 価格 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[1];
          const discountPrice2Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_2);
          return subtotalDiscount?.target_items?.includes(discountPrice2Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）1 get discount",
        expected: (res) => {
          const discount = discountPrice1Price - discountPrice;
          const discountPrice1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_1);
          return {
            isDiscount: true,
            subtotalDiscountApportionment: discount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountPrice1Idx]),
          };
        },
        actual: (res) => {
          const discountPrice1Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_1);
          return {
            isDiscount: res.result?.cartinfo?.items?.[discountPrice1Idx]?.total_statement_amount < res.result?.cartinfo?.items?.[discountPrice1Idx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountPrice1Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountPrice1Idx]?.total_statement_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）2 get discount",
        expected: (res) => {
          const discount = discountPrice2Price - discountPrice;
          const discountPrice2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_2);
          return {
            isDiscount: true,
            subtotalDiscountApportionment: discount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountPrice2Idx]),
          };
        },
        actual: (res) => {
          const discountPrice2Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_2);
          return {
            isDiscount: res.result?.cartinfo?.items?.[discountPrice2Idx]?.total_statement_amount < res.result?.cartinfo?.items?.[discountPrice2Idx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountPrice2Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountPrice2Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountPrice3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_PRICE_3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 販促品（価格）3",
        expected: {
          barcode: PROD.DISCOUNT_PRICE_3,
          displayUnitPrice: discountPrice3Price,
        },
        actual: (res) => {
          const discountPrice3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_3);
          return {
            barcode: res.result?.cartinfo?.items?.[discountPrice3Idx]?.barcode,
            displayUnitPrice: res.result?.cartinfo?.items?.[discountPrice3Idx]?.display_unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount amount of 価格 discount group",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const discountPrice3Idx = items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_3);
          return (discountPrice3Price - discountPrice) * items?.[discountPrice3Idx]?.quantity + discountAmountPriceBefore;
        },
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          return subtotalDiscount?.subtotal_discount_amount;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）3 belong to the 価格 discount group",
        expected: true,
        actual: (res) => {
          const cartinfo = res.result?.cartinfo;
          const subtotalDiscount = cartinfo?.subtotal_discounts?.[0];
          const discountPrice3Idx = cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_3);
          return subtotalDiscount?.target_items?.includes(discountPrice3Idx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）3 get discount",
        expected: (res) => {
          const items = res.result?.cartinfo?.items;
          const discountPrice3Idx = items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_3);
          const discount = (discountPrice3Price - discountPrice) * items?.[discountPrice3Idx]?.quantity;
          return {
            subtotalDiscountApportionment: discount,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountPrice3Idx]),
          };
        },
        actual: (res) => {
          const discountPrice3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_3);
          return {
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountPrice3Idx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountPrice3Idx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDiscountPrice1Rescan, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_PRICE_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 販促品（価格）1 (2nd) not discounted",
        expected: (res) => {
          const discountPrice3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_3);
          const discountPrice1SecondIdx = discountPrice3Idx + 1;
          return {
            displayUnitPrice: discountPrice1Price,
            subtotalDiscountApportionment: subtotalDiscountApportionmentNotApply,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[discountPrice1SecondIdx]),
          };
        },
        actual: (res) => {
          const discountPrice3Idx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.DISCOUNT_PRICE_3);
          const discountPrice1SecondIdx = discountPrice3Idx + 1;
          return {
            displayUnitPrice: res.result?.cartinfo?.items?.[discountPrice1SecondIdx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[discountPrice1SecondIdx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[discountPrice1SecondIdx]?.total_statement_amount,
          };
        },
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeNonPromo, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NON_PROMO,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 非販促品 not discounted",
        expected: (res) => {
          const nonPromoIdx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.NON_PROMO);
          return {
            displayUnitPrice: discountNonPromoPrice,
            subtotalDiscountApportionment: subtotalDiscountApportionmentNotApply,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[nonPromoIdx]),
          };
        },
        actual: (res) => {
          const nonPromoIdx = res.result?.cartinfo?.items?.findIndex(q => q.barcode === PROD.NON_PROMO);
          return {
            displayUnitPrice: res.result?.cartinfo?.items?.[nonPromoIdx]?.display_unit_price,
            subtotalDiscountApportionment: res.result?.cartinfo?.items?.[nonPromoIdx]?.subtotal_discount_apportionment,
            totalStatementAmount: res.result?.cartinfo?.items?.[nonPromoIdx]?.total_statement_amount,
          };
        },
      }),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}
