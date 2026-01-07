import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 売掛
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.CREDIT_SALE}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 掛売で支払った売上取引が返品できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 掛売客情報検索 | `/accounts-receivable/search` |
 * | 5 | 掛売支払登録 | `/sales/cart/accounts-receivable` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【返品】取引開始 | `/refund/begin` |
 * | 8 | 【返品】小計 | `/refund/subtotal` |
 * | 9 | 【返品】【掛売】掛売 | `/refund/cart/accounts-receivable` |
 * | 10 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_074で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品 : 4500000000121
 * * 2.顧客電話番号: 0252400711
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する（TC_074で実施する）。
 * * #### 5. 掛売支払登録 `/sales/cart/accounts-receivable`
 * * \- sales.payments[] データを取得する。
 * * #### 8. 【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 9. 【返品】掛売 `/refund/cart/accounts-receivable`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments に 売掛金 支払いが含まれる：
 * * * * ・void_payments[].paid_cd = sales.payments[].paid_cd  
 * * * * ・void_payments[].paid_name = sales.payments[].paid_name  
 * * * * ・void_payments[].paid_amount = sales.payments[].paid_amount  
 * * \- 返品後の合計金額が0であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 10. 【返品】取引完了 `/refund/end`
 * * \- レシートに以下の情報が含まれていることを確認する：
 * * * "売掛金"  
 * * \- 返金金額が販売取引と一致していることを確認する。
 */
export function TC_020723001_AccountsReceivable() {
  group("TC_020723001 売掛", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      searchAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.ACCOUNTS_RECEIVABLE_SEARCH),
      accountsReceivable: CommonFunction.getFullDesc(ENDPOINT.SALES_ACCOUNTS_RECEIVABLE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.REFUND_ACCOUNTS_RECEIVABLE),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const paidCode = PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_CODE;

    let cartNo = TestHelper.salesBegin(step.begin, {
      isSelf: false,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
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
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const clientCd = TestHelper.searchAccountsReceivable(step.searchAccountsReceivable, {}, [
      CHECK.createStatusCodeCheck(),
    ]).result?.client_infos?.[0]?.client_cd;

    const salesPayments = TestHelper.salesAccountsReceivable(step.accountsReceivable, {
      cartNo,
      clientCd,
      paidAmount: salesCartInfo?.total_balance_amount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const accountsReceivablePayment = salesPayments?.find(p => p.paid_cd === paidCode);

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

    cartNo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    const totalPaidAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundAccountsReceivable(step.refundAccountsReceivable, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payments contains 売掛金 payment",
        expected: {
          paidCd: accountsReceivablePayment?.paid_cd,
          paidName: accountsReceivablePayment?.paid_name,
          paidAmount: accountsReceivablePayment?.paid_amount,
        },
        actual: (res) => {
          const accountsReceivableVoidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === paidCode);
          return {
            paidCd: accountsReceivableVoidPayment?.paid_cd,
            paidName: accountsReceivableVoidPayment?.paid_name,
            paidAmount: accountsReceivableVoidPayment?.paid_amount,
          };
        },
      }),

      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: 売掛金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalPaidAmount);
          return CommonFunction.includesItems([
            PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_NAME,
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
