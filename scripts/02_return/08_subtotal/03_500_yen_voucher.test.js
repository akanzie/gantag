import * as CHECK from "../../../common/common_check.js";
import { group, sleep } from "k6";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 500円券を使用した売上の返品
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.USE_500_YEN_COUPON}
 * ### テスト観点
 * * 前提：
 * * 500円券を利用したの売上のレシート返品を行う
 * * テスト観点：
 * * * ・500円券を使用した売上取引を返品して、500円券適用後の金額が返金される。
 * * * ・500円券を使用した分のポイントも付与される
 * * * ・利用取消分の500円券が発券される
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | 取引①:前提（発券） | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 3 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 4 | 売価変更 | `/sales/cart/changeitemprice` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | call common getbalance | - |
 * | - | 取引②:前提（金券利用） | - |
 * | 9 | 取引開始 | `/sales/begin` |
 * | 10 | Aocaカードスキャン | `/sales/cart/barcode` |
 * | 11 | ポイント対象商品（対象） スキャン | `/sales/cart/barcode` |
 * | 12 | ポイント対象商品（上位参照）スキャン | `/sales/cart/barcode` |
 * | 13 | 小計 | `/sales/subtotal` |
 * | 14 | 500円券スキャン（1枚） | `/sales/cart/barcode` |
 * | 15 | 支払登録 | `/sales/addpayment` |
 * | 16 | 取引完了 | `/sales/end` |
 * | - | 取引③:テスト（金券利用取引を返品） | - |
 * | 17 | 【返品】取引開始 | `/refund/begin` |
 * | 18 | 【返品】小計 | `/refund/subtotal` |
 * | 19 | 【返品】支払登録 | `/refund/addpayment` |
 * | 20 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 500円券券発券～利用シナリオを実行、利用シナリオに対してレシート返品を実行する
 * 
 * ---
 * ### テストデータ
 * * 取引①:
 * * 1.クスリのアオキプリペイドカード: 8090227000000006 (Aok card)
 * * 2.ポイント対象商品（対象） : 4520230413001
 * * 取引②:
 * * 1.500円券
 * *     Barcode 1: 取引①で発行したもの
 * *     Barcode 2: 取引①で発行したもの
 * * 2.ポイント対象商品（対象） : 4520230413001
 * * 3. ポイント対象商品（上位参照）: 4500000000056
 * 
 * ---
 * ### 期待結果
 * * #### "10. Aocaカードスキャン `/sales/cart/barcode`
 * * \- カート情報にAocaカードが存在する:
 * * * \+ customer_cd = "8090227000000006"
 * * * \+ point_card_name = "Aoca"
 * * #### 14.500円券スキャン（1枚）`/sales/cart/barcode`
 * * \- sales.cartinfoを保持する
 * * #### 18. 【返品】小計   `/refund/subtotal`
 * * \- カート情報に以下の商品が存在する:
 * * * ポイント対象商品（対象）:
 * * * \+ barcode: 4520230413001
 * * * \+ unit_price: 150
 * * * \+ display_unit_price: 150
 * * * \+ total_statement_amount = (display_unit_price- subtotal_discount_apportionment ) x quantity =  (150-0)x1 = 150
 * * * ポイント対象商品（上位参照）:
 * * * \+ barcode: 4500000000056
 * * * \+ unit_price: 500
 * * * \+ display_unit_price: 500
 * * * \+ total_statement_amount = (display_unit_price- subtotal_discount_apportionment ) x quantity =  (500-100)x1 = 400
 * * \- カート情報のtotal_balance_amountを確認:
 * * * \+ total_balance_amount:  sales.total_balance_amount (total of total_statement_amount + total of total_statement_amount * 8% - 500 = (150 + 400) + 550 * 8% - 500 = 94
 * * #### 19. 【返品】支払登録 `/refund/addpayment`
 * * \- カート情報のvoid_paymentsを確認:
 * * \- 500円券
 * * * \+ payments.[].paid_group_cd= "0600"
 * * * \+ payments.[].paid_group_name = "金券
 * * * \+ payments.[].paid_cd = "0605"
 * * * \+ payments.[].paid_name= "500円券"
 * * * \+ payments.[].paid_amount= 500
 * * \- LINEPay
 * * * \+ payments.[].paid_group_cd= "0400"
 * * * \+ payments.[].paid_group_name = "バーコード決済"
 * * * \+ payments.[].paid_cd = "0412"
 * * * \+ payments.[].paid_name= "LINEPay"
 * * * \+ payments.[].paid_amount= 94(total_balance_amount was calculated in step 18)
 * * #### 20. 【返品】取引完了 `/refund/end`
 * * \- レシートに以下の情報が存在することを確認
 * * * ・ポイント対象商品（対象）
 * * * ・ポイント対象商品（上位参照）
 * * * ・ 31XXXXXXX (文字長20), 36XXXXXXX（文字長20）（５００円お買い物券のバーコード）
 * * * ・５００円  お買物券
 */
export function TC_020803001_ReturnsOfSalesUsing500YenVoucher() {
  group("TC_020803001 500円券を使用した売上の返品", () => {
    // Precondition step to set point to 400
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      usePoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_USE_POINT),
      addPoint: CommonFunction.getFullDesc(ENDPOINT.SETTLEMENT_ADD_POINT),
    };

    const step = {
      beginRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカードスキャン"),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）スキャン"),
      changePricePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE),
      subtotalRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      paymentRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      endRelease500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      beginUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN, `${ENDPOINT.SALES_BEGIN.desc} (2)`),
      barcodeAokiPrepaidUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "Aocaカード (2)スキャン"),
      barcodePointTargetUse: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（対象）(2)スキャン"),
      barcodePointTargetReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      subtotalUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL, `${ENDPOINT.SALES_SUBTOTAL.desc} (2)`),
      barcodeUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "500円券スキャン（1枚）"),
      paymentUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (2)`),
      endUse500YenVoucher: CommonFunction.getFullDesc(ENDPOINT.SALES_END, `${ENDPOINT.SALES_END.desc} (2)`),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const barcodeOpTypeMemberReg = 8; // Test data (type for MEMBER_REGISTRATION)
    const barcodeOpTypePaymentAssist = 3; // Test data (type for PAYMENT_ASSISTANCE)
    const updatedPrice = 100 * 100; // 100円 X 100 points. It will add 100 points. With precondition set 400 points, it will reach 500 point and release 500円 voucher
    const voucherAmount = 500; // For every 500 points, a 500円 voucher will be issued.
    const pointPrecondition = 400; // Precondition data
    const receiptNo = ENVIRONMENT.TMN_PREPAID_RECEIPT_NO;
    const pointTargetPrice = 150; // Specified in master
    const pointTargetReferUpperPrice = 500; // Specified in master

    // Run precondition to set Aok point equals 400
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const point = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo: CARD.AOKI_PREPAID.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.point_count_sum;

    // If point = 400, no need to run this API
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

    TestHelper.salesCartChangeItemPrice(step.changePricePointTarget, {
      cartNo,
      statementNo: 0,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const cartInfo = TestHelper.salesSubtotal(step.subtotalRelease500YenVoucher, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    let totalBalanceAmount = cartInfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.paymentRelease500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndReleaseResponse = TestHelper.salesEnd(step.endRelease500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    //3秒待機
    sleep(3);

    // Get barcode1 & barcode2 ５００円 from receipts[0]
    const {
      barcodePart1,
      barcodePart2,
    } = CommonFunction.getBarcodeData(salesEndReleaseResponse, /(31|36)\d{18}/g);

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
      CHECK.createEqualsCheck({
        name: "Verify the cart info has Aoka",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => ({
          customerCd: res.result?.cartinfo?.customer?.customer_cd,
          pointCardName: res.result?.cartinfo?.customer?.point_card_name,
        }),
      }),
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

    totalBalanceAmount = salesCartInfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.paymentUse500YenVoucher, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndUseResponse = TestHelper.salesEnd(step.endUse500YenVoucher, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    //3秒待機
    sleep(3);

    const salesReceiptNo = salesEndUseResponse.result?.receipt_no;
    const salesBusinessDay = salesEndUseResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalPaidAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 2 items",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント対象商品（対象）",
        expected: (res) => {
          const pointTarget = res.result?.cartinfo?.items?.find(q => q.barcode === PROD.POINT_TARGET);
          return {
            barcode: PROD.POINT_TARGET,
            unitPrice: pointTargetPrice,
            displayUnitPrice: pointTargetPrice,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(pointTarget),
          }
        },
        actual: (res) => {
          const pointTarget = res.result?.cartinfo?.items?.find(q => q.barcode === PROD.POINT_TARGET);
          return {
            barcode: pointTarget?.barcode,
            unitPrice: pointTarget?.unit_price,
            displayUnitPrice: pointTarget?.display_unit_price,
            totalStatementAmount: pointTarget?.total_statement_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント対象商品（上位参照）",
        expected: (res) => {
          const pointTargetReferUpper = res.result?.cartinfo?.items?.find(q => q.barcode === PROD.POINT_TARGET_REFER_UPPER);
          return {
            barcode: PROD.POINT_TARGET_REFER_UPPER,
            unitPrice: pointTargetReferUpperPrice,
            displayUnitPrice: pointTargetReferUpperPrice,
            totalStatementAmount: Formular.calcPriceAfterDiscounts(pointTargetReferUpper),
          };
        },
        actual: (res) => {
          const pointTargetReferUpper = res.result?.cartinfo?.items?.find(q => q.barcode === PROD.POINT_TARGET_REFER_UPPER);
          return {
            barcode: pointTargetReferUpper?.barcode,
            unitPrice: pointTargetReferUpper?.unit_price,
            displayUnitPrice: pointTargetReferUpper?.display_unit_price,
            totalStatementAmount: pointTargetReferUpper?.total_statement_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info total balance amount",
        expected: salesCartInfo?.total_sales_amount - voucherAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: totalPaidAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info void payments has: 500円券",
        expected: {
          paidGroupCd: PAID_METHOD.VOUCHER.GROUP_CODE,
          paidGroupName: PAID_METHOD.VOUCHER.GROUP_NAME,
          paidCd: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE,
          paidName: PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_NAME,
          paidAmount: voucherAmount,
        },
        actual: (res) => {
          const voucher500yen = res.result?.cartinfo?.void_payments?.find(q => q.paid_cd === PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER_YEN_500.PAID_CODE);
          return {
            paidGroupCd: voucher500yen?.paid_group_cd,
            paidGroupName: voucher500yen?.paid_group_name,
            paidCd: voucher500yen?.paid_cd,
            paidName: voucher500yen?.paid_name,
            paidAmount: voucher500yen?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info void payments has: LINEPay",
        expected: {
          paidGroupCd: PAID_METHOD.QRCODE.GROUP_CODE,
          paidGroupName: PAID_METHOD.QRCODE.GROUP_NAME,
          paidCd: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
          paidName: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_NAME,
          paidAmount: totalPaidAmount,
        },
        actual: (res) => {
          const linePay = res.result?.cartinfo?.void_payments?.find(q => q.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
          return {
            paidGroupCd: linePay?.paid_group_cd,
            paidGroupName: linePay?.paid_group_name,
            paidCd: linePay?.paid_cd,
            paidName: linePay?.paid_name,
            paidAmount: linePay?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contains: ポイント対象商品（対象） ポイント対象商品（上位参照）",
        expected: true,
        actual: (res) => {
          return CommonFunction.includesItems([
            PROD.POINT_TARGET,
            PROD.POINT_TARGET_REFER_UPPER,
          ], res.result?.receipts?.[res.result?.receipts?.length - 1]?.receipt_data);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contains: （文字長20）５００円お買い物券のバーコード",
        expected: true,
        actual: (res) => {
          const pattern = /(31|36)\d{18}/g;
          const data = CommonFunction.getBarcodeData(res, pattern);
          return data.barcodePart1 != null && data.barcodePart2 != null;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Receipt data must contains: ５００円 お買物券",
        expected: true,
        actual: (res) => {
          return CommonFunction.includesItems([
            "５００円  お買物券",
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
