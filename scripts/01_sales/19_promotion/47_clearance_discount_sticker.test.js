import * as CHECK from "../../../common/common_check.js";
import { group } from "k6";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 値引JANの割引・値引
 * @memberof 売上.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.CLOSEOUT_JAN}
 * {@link TAGS.SPECIFY_DISCOUNT_RATE}
 * ### テスト観点
 * * 見切りシールのバーコードを読み取り、割引率指定の場合は対象商品の価格に割引率を適用し、売価指定の場合は対象商品の価格を指定された売価とする。
 * * * → 値引JAN-割引：バーコード設定マスタの目的（purpose）が
 * * * * 　　  『値引JAN-割引-インストア以外』に該当する商品
 * * * 値引JAN-売価指：バーコード設定マスタの目的（purpose）が
 * * * * 　　  『値引JAN-売価指定-インストア以外』に該当する商品
 * * *    通常商品：通常の商品
 * * 値引JAN-割引は割引値引が適用され、値引JAN-売価指は売価指定の値引が適用される。
 * * 通常商品は値引が適用されない。
 * * 前提：
 * * * ・値引JANがm_barcodeに設定されている。
 * * * m_barcode.barcode_indicator_start = 09
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 値引JAN-割引スキャン | `/sales/cart/barcode` |
 * | 3 | 値引JAN-売価指スキャン | `/sales/cart/barcode` |
 * | 4 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 値引JAN-割引: 09450000000003210400
 * * 2. 値引JAN-売価指 : 09450920460000031500
 * * 3. 通常商品 : 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 2. 値引JAN-割引スキャン `/sales/cart/barcode`
 * * カートの情報に値引JAN-割引があることを確認
 * * * \+ barcode: 4500000000032
 * * * \+ unit_discount_detail_list.discount_rate: 40
 * * * \+ unit_price : 300
 * * * \+ display_unit_price = unit_price - (unit_price x discount_rate : 100) = 300 -(300x40:100) = 180
 * * #### 3. 値引JAN-売価指スキャン `/sales/cart/barcode`
 * * カートの情報に値引JAN-売価指があることを確認
 * * * \+ barcode: 45092046
 * * * \+ unit_price: 400
 * * * \+ display_unit_price: 150
 * * * \+ unit_price > display_unit_price
 * * #### 4. 通常商品スキャン `/sales/cart/barcode`
 * * カートの情報に通常商品があることを確認
 * * * \+ barcode: 4500000000121
 * * * \+ unit_price = display_unit_price
 * * #### 6. 支払登録 `/sales/addpayment`
 * * * \+ total_tax_amount が 58 と等しいことを確認
 * * * \+ total_quantity の長さが 3 と等しいことを確認
 * * * \+ total_sales_amount が 788 と等しいことを確認
 * * * \+ total_sales_amount_without_tax が 730 と等しいことを確認
 * * * \+ item の長さが 3 と等しいことを確認
 * * * \+ total_paid_amount が 788 と等しいことを確認
 * * * \+ total_change_amount が 0 と等しいことを確認
 * * #### 7. 取引完了 `/sales/end`
 * * * \+ レシートデータに値引JAN-割引 (4500000000032)、値引JAN-売価指 (45092046)、および通常商品 (4500000000121) が含まれていることを確認
 */
export function TC_011947001_CheckDiscountByJanCode() {
  group("TC_011947001 値引JANの割引・値引", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDiscountPercent: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "値引JAN-割引スキャン"),
      barcodeDiscountSpecifiedPrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "値引JAN-売価指スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const discountPercentUnitPrice = 300; // Specified in master
    const discountSpecifiedPrice = 400; // Specified in master
    const productRegularPrice = 400; // Specified in master
    const discountPercentObj = CommonFunction.createObjectFromDiscountRateProd(PROD.DISCOUNT_PERCENT);
    const discountSpecifiedObj = CommonFunction.createObjectFromPriceChangeProd(PROD.DISCOUNT_SPECIFIED_PRICE);

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.値引JAN-割引スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeDiscountPercent, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_PERCENT,
          scan_data_type: "Code128",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 値引JAN-割引: barcode, unit price, display unit price",
        expected: {
          barcode: discountPercentObj.barcode,
          discountRate: discountPercentObj.discountRate,
          unitPrice: discountPercentUnitPrice,
          displayUnitPrice: discountPercentUnitPrice - (discountPercentUnitPrice * discountPercentObj.discountRate / 100),
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[0]?.barcode,
            discountRate: res.result?.cartinfo?.items?.[0]?.unit_discount_detail_list?.[0]?.discount_rate,
            unitPrice: res.result?.cartinfo?.items?.[0]?.unit_price,
            displayUnitPrice: res.result?.cartinfo?.items?.[0]?.display_unit_price,
          };
        },
      }),
    ]);

    // 3.値引JAN-売価指スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeDiscountSpecifiedPrice, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_SPECIFIED_PRICE,
          scan_data_type: "Code128",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 値引JAN-売価指: barcode, unit price, display unit price",
        expected: {
          barcode: discountSpecifiedObj.barcode,
          unitPrice: discountSpecifiedPrice,
          displayUnitPrice: discountSpecifiedObj.displayUnitPrice,
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[1]?.barcode,
            unitPrice: res.result?.cartinfo?.items?.[1]?.unit_price,
            displayUnitPrice: res.result?.cartinfo?.items?.[1]?.display_unit_price,
          };
        },
      }),
    ]);

    // 4.通常商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 通常商品: barcode, unit price, display unit price",
        expected: {
          barcode: PROD.REGULAR,
          unitPrice: productRegularPrice,
          displayUnitPrice: productRegularPrice,
        },
        actual: (res) => {
          return {
            barcode: res.result?.cartinfo?.items?.[2]?.barcode,
            unitPrice: res.result?.cartinfo?.items?.[2]?.unit_price,
            displayUnitPrice: res.result?.cartinfo?.items?.[2]?.display_unit_price,
          };
        },
      }),
    ]);

    // 5.小計 /sales/subtotal
    const totalPaidAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_sales_amount;

    // 6.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: totalPaidAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total_tax_amount",
        expected: (res) => Formular.calcTotalTaxAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_tax_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total_quantity",
        expected: 3, // Scan 3 products, each product once
        actual: (res) => res.result?.cartinfo?.total_quantity,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total_sales_amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total_sales_amount_without_tax",
        expected: (res) => Formular.calcTotalTaxableAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify item length",
        expected: 3, // Scan 3 products, each product once
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total_paid_amount",
        expected: totalPaidAmount,
        actual: (res) => res.result?.cartinfo?.total_paid_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total_change_amount",
        expected: (res) => totalPaidAmount - Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_change_amount,
      }),
    ]);

    // 7.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contains 値引JAN-割引 (4500000000032), 値引JAN-売価指(45092046) and 通常商品 (4500000000121)",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          discountPercentObj.barcode,
          discountSpecifiedObj.barcode,
          PROD.REGULAR,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}
