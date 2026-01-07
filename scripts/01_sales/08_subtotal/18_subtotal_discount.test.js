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
 * @function 小計割引の手入力
 * @memberof 売上.小計
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.SUBTOTAL_PROMO_DISCOUNT}
 * {@link TAGS.NO_REASON}
 * ### テスト観点
 * * 前提：
 * * * ・操作小計値引がm_unit_discountに設定されている。
 * * * ・単品値引商品は、m_store_item.allow_discount_type=1（値引対象） or 9（上位参照）のもの。
 * * テスト観点：
 * * 小計後に選択肢から割引を選択して小計割引が適用される
 * * `/sales/cart/subtotaldiscount`をdiscount_type =1（割引）で実行
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 単品値引商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 小計割引ボタンを押下し割引率入力 | `/sales/cart/subtotaldiscount` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.単品値引商品: 2099998000039
 * 
 * ---
 * ### 期待結果
 * * #### 3.小計 `/sales/subtotal`
 * * \- カート情報の支払残額を確認
 * * * \+ total_sales_amount = 4000
 * * #### 4.小計割引ボタンを押下し割引率入力 　`/sales/cart/subtotaldiscount`
 * * カート情報の支払残額を確認
 * * \- 小計割引の割引率 (subtotal_discount_rate)
 * * * \+ subtotal_discount_rate = 40
 * * \-値割引額 (subtotal_discount_amount = 1600 = 4000*40%)
 * * * \+ subtotal_discount_amount= 1600
 * * \- 合計売上額 (total_sales_amount = 2400 = 4000-1600)
 * * * \+ total_sales_amount = 2400
 */
export function TC_010818001_SubTotalDiscount() {
  group("TC_010818001 小計割引の手入力", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeSingleDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "単品値引商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      subtotalDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_SUBTOTAL_DISCOUNT),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const discountValue = 40; // Manual import discount amount
    const discountType = 1; // Indicates that the total amount will be deducted by discount rate from manual import (割引率) 

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

    // 3.小計 /sales/subtotal
    const totalSalesAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_sales_amount;

    // 4.小計割引ボタンを押下し割引率入力 /sales/cart/subtotaldiscount
    const subtotalDiscountAmountExpected = (totalSalesAmount ?? 0) * discountValue / 100;
    const totalSalesAmountExpected = (totalSalesAmount ?? 0) - subtotalDiscountAmountExpected;
    const totalBalanceAmount = TestHelper.salesSubtotalDiscount(step.subtotalDiscount, {
      cartNo,
      discountType,
      discountValue,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount rate",
        expected: discountValue,
        actual: (res) => res.result?.cartinfo?.operation_subtotal_discount?.subtotal_discount_rate,
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount amount",
        expected: subtotalDiscountAmountExpected,
        actual: (res) => res.result?.cartinfo?.operation_subtotal_discount?.subtotal_discount_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: totalSalesAmountExpected,
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 6.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}
