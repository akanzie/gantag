import * as CHECK from "../../../common/common_check.js";
import { group, sleep } from "k6";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 500円券
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.USE_500_YEN_COUPON}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 500円券の売上取引が誤打訂正の途中で中断できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引1: | - |
 * | 0 | Aok card のポイントを400点にセット | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 4 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 5 | 売価変更 | `/sales/cart/changeitemprice` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 共通メソッドのgetbalanceを実行 | - |
 * | - | 取引2: | - |
 * | 10 | 取引開始 | `/sales/begin` |
 * | 11 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 12 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 13 | 小計 | `/sales/subtotal` |
 * | - | 14.500円券スキャン（1枚）`/sales/cart/barcode` | - |
 * | 15 | 支払登録 | `/sales/addpayment` |
 * | 16 | 取引完了 | `/sales/end` |
 * | 17 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | →　上記1~8の取引（売上）のレシートをスキャン | - |
 * | 18 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 1. 販売取引はテストの観点に基づき、TC_018で検証済み。 
 * * 2. 取引2
 * *  取引1 の取引完了 `/sales/end`のバーコードを取得
 * * \- バーコード1 は prefix が 31、桁数は 20 桁
 * * \- バーコード2 は prefix が 36、桁数は 20 桁
 * 
 * ---
 * ### テストデータ
 * * 取引1:
 * * 1. クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 2. ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 取引2:
 * * 1. バーコード1 とバーコード2
 * * 2. ポイント対象商品（対象） : 4520230413001 (point_apply_type_1 = 1)
 * * 3.  ポイント対象商品（上位参照）: 4500000000056 (point_apply_type_1 = 9)
 * 
 * ---
 * ### 期待結果
 * *  * データ取得（販売取引 TC_018 にて検証済み）
 * * #### 13.小計 `/sales/subtotal`
 * * \- payments を取得
 * * \- total_balance_amount を取得
 * * #### 17. 【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致することを確認
 * * * \+ total_balance_amount = sales.total_balance_amount
 * * \- void_payments に 500円券支払いが含まれていることを確認
 * * * \+ void_payments に voucher 500円 payment が含まれていること
 * * * \+ paid_cd = sales.payments.paid_cd
 * * * \+ paid_name = sales.payments.paid_name
 * * * \+ paid_amount = sales.payments.paid_amount
 * * #### 18. 【誤打訂正】取引中断 `/void/abort`
 * * \- 中断成功および receipt_no が付与されていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_041107001_VoidAbortUse500YenVoucher() {
  group("TC_041107001 500円券", () => {
    // Precondition step to set point to 400
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      addPoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_ADD_POINT),
    };

    const step = {
      beginRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (取引1)`),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン (取引1)"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン (取引1)"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン (取引1)"),
      changePricePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE, `${ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE.desc} (取引1)`),
      subtotalRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (取引1)`),
      paymentRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (取引1)`),
      endRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (取引1)`),
      beginUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (取引2)`),
      barcodeAokiPrepaidUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン (取引2)"),
      barcodePointTargetUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン (取引2)"),
      barcodePointTargetReferUpperUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン (取引2)"),
      subtotalUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (取引2)`),
      barcodeUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（1枚） (取引2)"),
      paymentUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (取引2)`),
      endUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (取引2)`),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN, `${ENDPOINT.VOID_BEGIN.desc} (取引2)`),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT, `${ENDPOINT.VOID_ABORT.desc} (取引2)`),
    };

    const barcodeOpTypeMemberReg = 8; // Test data. バーコード業務種別 (8: 会員登録)
    const barcodeOpTypePaymentAssist = 3; // Test data. バーコード業務種別 (3: 小計中)
    const updatedPrice = 100 * 100; // 100円 X 100 points. It will add 100 points. With precondition set 400 points, it will reach 500 point and release 500円 voucher
    const pointPrecondition = 400; // Precondition data
    const receiptNo = ENVIRONMENT.TMN_PREPAID_RECEIPT_NO;

    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const point = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    if (point != pointPrecondition)
    {
      if (point > 0) {
        TestHelper.settlementUsePoint(preStep.usePoint, {
          cardNo: CARD.AOKI_PREPAID.CODE,
          receiptNo,
          usagePointCount: point,
        }, [
          CHECK.createStatusCodeCheck(),
        ]);
      };

      TestHelper.settlementAddPoint(preStep.addPoint, {
        cardNo: CARD.AOKI_PREPAID.CODE,
        receiptNo,
        designatedExtentionLimitPointCount: pointPrecondition,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    };

    let cartNo = TestHelper.salesBegin(step.beginRelease500YenVoucher, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: barcodeOpTypeMemberReg,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodePointTarget, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodePointTargetReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartChangeItemPrice(step.changePricePointTarget, {
      cartNo,
      statementNo: 0, // Change the price of the first item in the cart
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotalRelease500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.paymentRelease500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.endRelease500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    // Get barcode1 & barcode2 of ５００円券
    const {
      barcodePart1,
      barcodePart2,
    } = CommonFunction.getBarcodeData(salesEndResponse, /(31|36)\d{18}/g);

    cartNo = TestHelper.salesBegin(step.beginUse500YenVoucher, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeAokiPrepaidUse, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: barcodeOpTypeMemberReg,
    }, [
      CHECK.createStatusCodeCheck(),
    ], ENVIRONMENT.RETRY_TIMES);

    TestHelper.salesCartBarcode(step.barcodePointTargetUse, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodePointTargetReferUpperUse, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesSubtotal(step.subtotalUse500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesCartBarcode(step.barcodeUse500YenVoucher, {
      cartNo,
      barcodes: [
        {
          barcode: barcodePart1,
          scan_data_type: "JAN13",
        },
        {
          barcode: barcodePart2,
          scan_data_type: "JAN13",
        },
      ],
      barcodeOperationType: barcodeOpTypePaymentAssist,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payment500YenVoucher = salesCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE);

    TestHelper.salesAddPayment(step.paymentUse500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndUseResponse = TestHelper.salesEnd(step.endUse500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndUseResponse.result?.receipt_no;
    const salesBusinessDay = salesEndUseResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify void payments include voucher 500円 payment",
        expected: {
          paidCd: payment500YenVoucher?.paid_cd,
          paidName: payment500YenVoucher?.paid_name,
          paidAmount: payment500YenVoucher?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(q => q.paid_cd === PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.cart_no;

    TestHelper.voidAbort(step.voidAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify abort success and has receipt_no",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
}
