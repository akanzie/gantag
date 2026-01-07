import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { group } from "k6";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 保留一連の操作
 * @memberof 売上.保留
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.ON_HOLD}
 * {@link TAGS.PRODUCT_TYPE}
 * {@link TAGS.PENDING_REGISTRATION}
 * {@link TAGS.CALL_ON_HOLD}
 * {@link TAGS.NONPLU}
 * {@link TAGS.MULTIPLE_REGISTRATION}
 * {@link TAGS.SINGLE_CALL}
 * ### テスト観点
 * * 前提：
 * * * ・2つの取引を保留する
 * * * * →　1つ目の取引（通常商品スキャン→取引保留）
 * * * * →　2つ目の取引（NONPLU商品スキャン→取引保留）
 * * * ・複数の取引保留を呼び出す
 * * * ・1つ目の取引を呼出して、支払完了まで実施する。
 * * * ・2つ目の取引を呼出して、支払完了まで実施する。
 * * テスト観点：
 * * * ・現在の取引を退避して、別の取引を開始できる。
 * * * ・複数の取引を保留でき、支払完了まで順番に処理することができます。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | 準備ステップ | - |
 * | 0.1 | - | `/hold/getList` |
 * | 0.2 | - | `hold/remove` (cart_noが存在すれば削除) |
 * | 1 | 取引1開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 取引1保留 | `/hold` |
 * | 4 | 取引2開始 | `/sales/begin` |
 * | 5 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 6 | 取引2保留 | `/hold` |
 * | 7 | 保留一覧取得(1st) | `/hold/getList` |
 * | 8 | 保留取引呼出(取引1 通常商品) | `/hold/restore` |
 * | 9 | 小計(取引1 通常商品) | `/sales/subtotal` |
 * | 10 | 支払登録(取引1 通常商品) | `/sales/addpayment` |
 * | 11 | 取引1完了 | `/sales/end` |
 * | 12 | 保留取引削除(取引1 通常商品) | `/hold/remove` |
 * | 13 | 保留一覧取得(2nd) | `/hold/getList` |
 * | 14 | 保留取引呼出(取引2 NONPLU商品) | `/hold/restore` |
 * | 15 | 小計(取引2 NONPLU商品) | `/sales/subtotal` |
 * | 16 | 支払登録(取引2 NONPLU商品) | `/sales/addpayment` |
 * | 17 | 取引2完了 | `/sales/end` |
 * | 18 | 保留取引削除(取引2 NONPLU商品) | `/hold/remove` |
 * | 19 | 保留一覧取得(3rd) | `/hold/getList` |
 * 
 * ---
 * ### 前提条件
 * * ms-config.c_config_corporate
 * * PosHoldLimit  = 2
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品 : 4500000000121
 * * 2. NONPLU商品 : 0445000701007
 * 
 * ---
 * ### 期待結果
 * * #### 2. 通常商品スキャン `/sales/cart/barcode`
 * * \- 保留前の1つ目の取引を確認:
 * * * \+ barcode: 4500000000121
 * * *後で保留一覧で確認するため、cart_no を記録
 * * #### 5. NONPLU商品スキャン `/sales/cart/barcode`
 * * \- 保留前の2つ目の取引を確認:
 * * * \+ barcode: 0445000700000
 * * *後で保留一覧で確認するため、cart_no を記録
 * * #### 7. 保留一覧取得(1st) `/hold/getList`
 * * \- 2件の取引が保留中であることを確認:
 * * * \+ hold_list_elements.length = 2
 * * * \+ hold info contains に手順2の cart_no と 手順5の cart_no が含まれていること
 * * #### 9. 小計(取引1 通常商品) `/sales/subtotal`
 * * \- cart_no が 手順2の cart_no と一致すること
 * * \- カートに通常商品が1件入っていること
 * * * \+ items.length: 1
 * * * \+ barcode: 4500000000121
 * * * \+ quantity: 1
 * * #### 11. 取引1完了 `/sales/end`
 * * \- レシートデータに通常商品が含まれていること:
 * * * \+ receipt_data contains 4500000000121 from step 2
 * * #### 13. 保留一覧取得(2nd) `/hold/getList`
 * * \- 1件のみ保留中であることを確認:
 * * * \+ hold_list_elements.length = 1
 * * * \+ hold info に手順5の cart_no が残っていること
 * * #### 15. 小計(取引2 NONPLU商品) `/sales/subtotal`
 * * \- cart_no が 手順5の cart_no と一致すること
 * * \- cart info に NONPLU 商品が1件入っていること
 * * * \+ items.length: 1
 * * * \+ barcode: 0445000701000
 * * * \+ quantity: 1
 * * #### 17. 取引2完了 `/sales/end`
 * * \- レシートデータに NONPLU 商品が含まれていること
 * * * \+ receipt_data contains 0445000700000 from step 5
 * * #### 19. 保留一覧取得(3rd) `/hold/getList`
 * * \- 保留中の取引がないこと
 * * * \+ hold_list_elements.length = 0
 */
export function TC_011436001_HoldTransactionFlow() {
  group("TC_011436001_HoldTransactionFlow 保留一連の操作", () => {
    const preStep = {
      holdGetList: CommonFunction.getFullDesc(ENDPOINT.HOLD_GET_LIST),
      holdRemove: CommonFunction.getFullDesc(ENDPOINT.HOLD_REMOVE),
    };

    const step = {
      beginRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, "取引1開始"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      holdRegular: CommonFunction.getFullDesc(ENDPOINT.HOLD, "取引1保留"),
      beginNonPLU: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, "取引2開始"),
      barcodeNonPLU: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      holdNonPLU: CommonFunction.getFullDesc(ENDPOINT.HOLD, "取引2保留"),
      getHoldList1st: CommonFunction.getFullDesc(ENDPOINT.HOLD_GET_LIST, "保留一覧取得(1st)"),
      holdRestoreRegular: CommonFunction.getFullDesc(ENDPOINT.HOLD_RESTORE, "保留取引呼出(取引1 通常商品)"),
      subtotalRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, "小計(取引1 通常商品)"),
      paymentRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録(取引1 通常商品)"),
      endRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_END, "取引1完了"),
      holdRemoveRegular: CommonFunction.getFullDesc(ENDPOINT.HOLD_REMOVE, "保留取引削除(取引1 通常商品)"),
      getHoldList2nd: CommonFunction.getFullDesc(ENDPOINT.HOLD_GET_LIST, "保留一覧取得(2nd)"),
      holdRestoreNonPLU: CommonFunction.getFullDesc(ENDPOINT.HOLD_RESTORE, "保留取引呼出(取引2 NONPLU商品)"),
      subtotalNonPLU: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, "小計(取引2 NONPLU商品)"),
      paymentNonPLU: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録(取引2 NONPLU商品)"),
      endNonPLU: CommonFunction.getFullDesc(ENDPOINT.SALES_END, "取引2完了"),
      holdRemoveNonPLU: CommonFunction.getFullDesc(ENDPOINT.HOLD_REMOVE, "保留取引削除(取引2 NONPLU商品)"),
      getHoldListFinal: CommonFunction.getFullDesc(ENDPOINT.HOLD_GET_LIST, "保留一覧取得(3rd)"),
    };

    const statusSuccess = 200;

    // Prestep: Get pending list → Delete all pending transactions if exist
    const cartHolds = TestHelper.holdGetList(preStep.holdGetList, [
      CHECK.createStatusCodeCheck(),
    ]).result?.hold_list_elements;

    if (cartHolds?.length > 0) {
      cartHolds?.forEach((cartHold, index) => {
        TestHelper.holdRemove(`${preStep.holdRemove} ${index + 1}`, {
          cartNo: cartHold?.holdinfo?.cart_no,
        }, [
          CHECK.createStatusCodeCheck(),
        ]);
      });
    }

    let holdListLength = 0; // After prestep, no transactions are currently on hold

    const cartNoRegularItem = TestHelper.salesBegin(step.beginRegular, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo: cartNoRegularItem,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the first transaction before hold",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    let status = TestHelper.hold(step.holdRegular, {
      cartNo: cartNoRegularItem,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).status;

    if (status === statusSuccess) holdListLength++;

    const cartNoNonPLUItem = TestHelper.salesBegin(step.beginNonPLU, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeNonPLU, {
      cartNo: cartNoNonPLUItem,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the second transaction before hold",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    status = TestHelper.hold(step.holdNonPLU, {
      cartNo: cartNoNonPLUItem,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).status;

    if (status === statusSuccess) holdListLength++;

    TestHelper.holdGetList(step.getHoldList1st, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that 2 transactions are on hold",
        expected: {
          holdListLength: holdListLength,
          cartNo1st: cartNoRegularItem,
          cartNo2nd: cartNoNonPLUItem,
        },
        actual: (res) => {
          const holdInfo1st = res.result?.hold_list_elements?.find(h => h.holdinfo?.cart_no === cartNoRegularItem);
          const holdInfo2st = res.result?.hold_list_elements?.find(h => h.holdinfo?.cart_no === cartNoNonPLUItem);
          return {
            holdListLength: res.result?.hold_list_elements?.length,
            cartNo1st: holdInfo1st?.holdinfo?.cart_no,
            cartNo2nd: holdInfo2st?.holdinfo?.cart_no,
          };
        },
      }),
    ]);

    TestHelper.holdRestore(step.holdRestoreRegular, {
      cartNo: cartNoRegularItem,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const totalBalanceAmountRegular = TestHelper.salesSubtotal(step.subtotalRegular, cartNoRegularItem, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that the cart_no matches the cart_no from step 2",
        expected: cartNoRegularItem,
        actual: (res) => res.result?.cartinfo?.cart_no,
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product 通常商品",
        expected: {
          itemsLength: 1,
          barcode: PROD.REGULAR,
          quantity: 1,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.find(item => item.barcode === PROD.REGULAR);
          return {
            itemsLength: res.result?.cartinfo?.items?.length,
            barcode: item?.barcode,
            quantity: item?.quantity,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.paymentRegular, {
      cartNo: cartNoRegularItem,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount: totalBalanceAmountRegular,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.endRegular, {
      cartNo: cartNoRegularItem,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that receipt data contains item 通常商品",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    status = TestHelper.holdRemove(step.holdRemoveRegular, {
      cartNo: cartNoRegularItem,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).status;

    if (status === statusSuccess) holdListLength--;

    TestHelper.holdGetList(step.getHoldList2nd, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that 1 transactions are on hold",
        expected: {
          holdListLength: holdListLength,
          cartNo: cartNoNonPLUItem,
        },
        actual: (res) => {
          const holdInfo = res.result?.hold_list_elements?.find(h => h.holdinfo?.cart_no === cartNoNonPLUItem);
          return {
            holdListLength: res.result?.hold_list_elements?.length,
            cartNo: holdInfo?.holdinfo?.cart_no,
          };
        },
      }),
    ]);

    TestHelper.holdRestore(step.holdRestoreNonPLU, {
      cartNo: cartNoNonPLUItem,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const totalBalanceAmountNonPLU = TestHelper.salesSubtotal(step.subtotalNonPLU, cartNoNonPLUItem, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that the cart_no matches the cart_no from step 5",
        expected: cartNoNonPLUItem,
        actual: (res) => res.result?.cartinfo?.cart_no,
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 product NONPLU商品",
        expected: {
          itemsLength: 1,
          barcode: PROD.NONPLU_MATCHED,
          quantity: 1,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.find(item => item.barcode === PROD.NONPLU_MATCHED);
          return {
            itemsLength: res.result?.cartinfo?.items?.length,
            barcode: item?.barcode,
            quantity: item?.quantity,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.paymentNonPLU, {
      cartNo: cartNoNonPLUItem,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount: totalBalanceAmountNonPLU,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesEnd(step.endNonPLU, {
      cartNo: cartNoNonPLUItem,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that receipt data contains item NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.NONPLU_MATCHED,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    status = TestHelper.holdRemove(step.holdRemoveNonPLU, {
      cartNo: cartNoNonPLUItem,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).status;

    if (status === statusSuccess) holdListLength--;

    TestHelper.holdGetList(step.getHoldListFinal, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that no transaction is on hold",
        expected: holdListLength,
        actual: (res) => res.result?.hold_list_elements?.length,
      }),
    ]);
  });
}
