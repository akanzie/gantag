import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 売上～誤打訂正の中止
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.SALES_OPERATIONS}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CASH}
 * ### テスト観点
 * * 前提：
 * * * ・通常商品
 * * * ・現金で支払う。
 * * テスト観点：
 * * 誤打訂正が途中で中止される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | →　上記1~5の取引（売上）のレシートをスキャン | - |
 * | 7 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- カート情報に通常商品が含まれていることを確認する
 * * * \+ barcode: 4500000000121
 * * #### 7. 【誤打訂正】取引中断 `/void/abort`
 * * \- 中断が成功し、receipt_no が取得されていることを確認する
 * * * \+ receipt_no > 0
 */
export function TC_040514001_AbortVoid() {
  group("TC_040514001 売上～誤打訂正の中止", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

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
        name: "Verify the cart info has 通常医薬品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.voidAbort(step.voidAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has information receipt_no > 0",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
}
