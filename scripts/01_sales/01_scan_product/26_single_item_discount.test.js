import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 複数の商品登録・単品値引
 * @memberof 売上.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.PRODUCT_TYPE}
 * {@link TAGS.CHANGE_DETAILS}
 * {@link TAGS.NONPLU}
 * {@link TAGS.SINGLE_ITEM_DISCOUNT}
 * ### テスト観点
 * * 前提：
 * * * ・操作単品値引がm_unit_discountに設定されている。
 * * * ・値引商品は、m_store_item.allow_discount_type=1（値引対象） or 9（上位参照）のもの。=> 通常商品
 * * * ・値引でない商品は何でもよい。=> NONPLU商品
 * * テスト観点：
 * * 選択した商品明細に値引が適用される
 * * * ・小計には2個の商品
 * * * ・値引商品は値引されている
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 通常商品操作値引 | `/sales/cart/unitdiscount` |
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
 * * 1. 通常商品: 4500000000121
 * * 2. NONPLU商品（値引商品）: 0445000701007
 * 
 * ---
 * ### 期待結果
 * * #### 2.通常商品スキャン `/sales/cart/barcode`
 * * \- 通常商品を確認する
 * * * \+ total_statement_amount: 400
 * * #### 3.NONPLU商品スキャン `/sales/cart/barcode`
 * * \- 値引前のカートInfoを確認
 * * \-> Total price = items[0].unit_price + items[1].unit_price = 400 + 100 = 500
 * * \-> Total tax = items[0].unit_price x (items[0].tax_rate`/100`) + items[1].unit_price x (items[1].tax_rate`/100`) = 400 x 8% + 100 x 8% = 40
 * * * \+ total_sales_amount = Total price + Total tax = 500 + 40 = 540
 * * #### 4.通常商品操作値引 `/sales/cart/unitdiscount`
 * * \- Confirm 通常商品 is discounted and has the correct value:
 * * * \+ unit_price: 400
 * * * \+ unit_discount_amount: 40
 * * * \+ total_statement_amount = unit_price - unit_discount_amount = 400 - 40 = 360 (Price is reduced from the original price in step 2)
 * * \- Confirm the total amount correct after applying the discount
 * * * \+ 通常商品 has discount price 360, tax 8%
 * * * \+ NONPLU商品 has price 100, tax 8%
 * * * *  (follow the same formula in step 3)
 * * \-> Total price = 360 + 100 = 460
 * * \-> Total tax = 360 x 8% + 100 x 8% = 36 (to round down)
 * * * \+ total_sales_amount = Total price + Total tax = 460 + 36 = 496 (Price is reduced from the original cart price in step 3)
 * * #### 5.小計 `/sales/subtotal`
 * * \- Confirm the cart info has  2 products:
 * * * \+ 通常商品 barcode: 4500000000121
 * * * \+ NONPLU商品 barcode: 0445000701007
 */
export function TC_010126001_RegisterMultipleProductsAndApplySingleItemDiscount() {
  group("TC_010126001 複数の商品登録・単品値引", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPLU: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      unitDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_UNIT_DISCOUNT, "通常商品操作値引"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    // Test data
    const discountType = "2"; // Indicates that the total amount will be deducted directly from manual import (値引額)
    const discountValue = 40; // Manual import discount amount

    const paidGroupCode = PAID_METHOD.QRCODE.GROUP_CODE;
    const paidCode = PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE;
    const details = ENVIRONMENT.LINEPAY_DETAIL;

    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    const regularProductRes = TestHelper.salesCartBarcode(step.barcodeRegular, {
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
        name: "Verify 通常商品 original price",
        expected: (res) => Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[0]),
        actual: (res) => res.result?.cartinfo?.items?.[0]?.total_statement_amount,
      }),
    ]);

    TestHelper.salesCartBarcode(step.barcodeNonPLU, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart price before discount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]);

    TestHelper.salesCartUnitDiscount(step.unitDiscount, {
      cartNo,
      discountType,
      discountValue,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 通常商品 is discounted and has the correct value",
        expected: (res) => {
          return {
            unitPrice: regularProductRes.result?.cartinfo?.items?.[0]?.unit_price,
            unitDiscountAmount: discountValue,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.[0]),
          };
        },
        actual: (res) => {
          return {
            unitPrice: res.result?.cartinfo?.items?.[0]?.unit_price,
            unitDiscountAmount: res.result?.cartinfo?.items?.[0]?.unit_discount_amount,
            totalStatementAmount: res.result?.cartinfo?.items?.[0]?.total_statement_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total amount correct after applying the discount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 products",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
    ]).result?.cartinfo.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode,
      paidCode,
      totalBalanceAmount,
      details,
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
