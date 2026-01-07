import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group } from "k6";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 小計値引の手入力
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.SUBTOTAL_MANUAL_REDUCTION}
 * {@link TAGS.NO_REASON}
 * ### テスト観点
 * * 前提：
 * * * ・操作小計値引がm_unit_discountに設定されている。
 * * * ・単品値引商品は、m_store_item.allow_discount_type=1（値引対象） or 9（上位参照）のもの。
 * * * ・商品Bは何でもよい。
 * * テスト観点：
 * * 小計後に選択肢から値引を選択して小計値引が適用される
 * * `/sales/cart/subtotaldiscount`をdiscount_type =2（値引）で実行
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 単品値引商品スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 小計値引ボタンを押下し値引金額入力 | `/sales/cart/subtotaldiscount` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.単品値引商品: 2099998000039
 * * 2.通常商品: 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * \- Confirm the amount before discount:
 * * * \+ total_sales_amount = 4432
 * * #### 5.小計割引ボタンを押下し割引率入力 `/sales/cart/subtotaldiscount`
 * * \- Confirm the discount amount is correct
 * * * \+ subtotal_discount_amount= 40
 * * \- Confirm the total amount after applying the discount
 * * * \+ 単品値引商品 has price 4000, tax 0%
 * * \-> The reduction of 単品値引商品 on total price:  (4000/(4000+400))x40 = 37 (to round up)
 * * * \+ 通常商品 has price 400, tax 8%
 * * \-> The reduction of 通常商品 on total price:  (400/(4000+400))x40 = 4 (to round up)
 * * * \+ Difference of subtotal discount:  40 - (37+4)  = -1 (residual)
 * * * \+ Redistribute discounts based on product price (high -> low)
 * * \-> The reduction correct of 単品値引商品: 37 - 1= 36
 * * * \+ Total tax: (4000 - 36) x 0% + (400-4) x 8% = 31 (to round down)
 * * * \+ total_sales_amount = 4391 = ((4000+400)- 40) + 31
 */
export function TC_010854001_ManualEntryOfSubtotalDiscount() {
  group("TC_010854001 小計値引の手入力", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeSingleDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "単品値引商品スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      subtotalDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_SUBTOTAL_DISCOUNT, "小計値引ボタンを押下し値引金額入力"),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const discountValue = 40; // Manual import discount amount
    const discountType = 2; // Indicates that the total amount will be deducted directly from manual import (値引額) 

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.単品値引商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeSingleDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SINGLE_DISCOUNT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 3.通常商品スキャン /sales/cart/barcode
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
    ]);

    //4.小計 /sales/subtotal
    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the total amount before applying the discount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]);

    //5.小計値引ボタンを押下し値引金額入力 /sales/cart/subtotaldiscount
    const totalBalanceAmount = TestHelper.salesSubtotalDiscount(step.subtotalDiscount, {
      cartNo,
      discountType,
      discountValue,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the discount amount is correct",
        expected: discountValue,
        actual: (res) => res.result?.cartinfo?.operation_subtotal_discount?.subtotal_discount_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total amount after applying the discount",
        expected: (res) => {
          // Redistribute item prices
          const redistributeItems = Formular.redistributeItemsDiscountAmount({
            items: res.result?.cartinfo?.items,
            discountAmount: discountValue,
          });
          return redistributeItems.reduce((total, item) => {
            const tax = Math.trunc((item.display_unit_price - item.subtotal_discount_apportionment) * (item.tax_rate / 100));
            return total + ((item.display_unit_price - item.subtotal_discount_apportionment) + tax)
          }, 0);
        },
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 6.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 7.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}
